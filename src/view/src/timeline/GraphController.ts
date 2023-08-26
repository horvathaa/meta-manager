import * as d3 from 'd3';
import TimelineController, { Payload } from './TimelineController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import { SerializedChangeBuffer, Event, DataSourceType } from '../types/types';

// const color = d3.scaleOrdinal(
//     ['hJyV36Xgy8gO67UJVmnQUrRgJih1', 'ambear9@gmail.com'],
//     ['#4e79a7', '#e15759']
// );

const source = d3.scaleOrdinal(
    ['git', 'vscode', 'CHAT_GPT', 'STACKOVERFLOW', 'GITHUB', 'pasted-code'],
    ['#4e79a7', '#8dc149', '#f28e2b', '#76b7b2', '#59a14f']
);

class GraphController {
    private readonly width = 640;
    private readonly height = 500;
    private readonly marginTop = 20;
    private readonly marginRight = 0;
    private readonly marginBottom = 60;
    private readonly marginLeft = 40;
    private readonly totalWidth = window.innerWidth;
    chart: any;

    constructor(private readonly timelineController: TimelineController) {
        // this.constructGraph(data);
    }

    getColor(d: TimelineEvent) {
        if (d._dataSourceType === 'git') {
            return source(d._dataSourceType);
        } else if (d._dataSourceType === 'meta-past-version') {
            const data = d.originalData as SerializedChangeBuffer;
            if (data.eventData) {
                if (data.eventData[Event.WEB]) {
                    return source(data.eventData[Event.WEB].copyBuffer.type);
                }
                if (data.eventData[Event.PASTE]) {
                    return source('pasted-code'); // should get a better type for this
                }
            }
        }

        return source('vscode');
    }

    constructGraph(data: any) {
        // const val = this.drawTimeline(data.items);
        const val = this.makeDynamicXAxis(data.prMap, data.items);
        return val;
    }

    pointerentered(e: any, k: any) {
        console.log('POINTER ENTERED!!!!!!!!', e, k);
        // path.style('mix-blend-mode', null).style('stroke', '#ddd');
        // dot.attr('display', null);
        this.timelineController.renderMetadata(k);
    }

    pointerleft(e: any, k: any) {
        // console.log('POINTER LEFT!!!!!!!!', e, k);
        this.timelineController.renderMetadata(undefined);
        // path.style('mix-blend-mode', 'multiply').style('stroke', null);
        // dot.attr('display', 'none');
        // svg.node().value = null;
        // svg.dispatch('input', { bubbles: true });
    }
    strictIsoParse = d3.utcParse('%Y-%m-%dT%H:%M:%S.%LZ');

    makeDynamicXAxis(
        data: {
            [k: number]: {
                [commit: string]: TimelineEvent[];
            };
        },
        // svg: any,
        nonClustered: TimelineEvent[]
    ) {
        const svg = d3.select('svg');
        svg.selectAll('*').remove();
        const context = this;
        let size = 0;
        const rangeBands: string[] = [];
        const barPadding = 10;

        const formattedArray = Object.keys(data).map(function (key) {
            const objs = Object.keys(data[parseInt(key)]).map((commit) => {
                return { [commit]: data[parseInt(key)][commit] };
            });
            return {
                key: key,
                values: objs, // Assuming you want to work with "Mechanical" category
                cummulative: 0,
            };
        });

        formattedArray.forEach((k, i) => {
            // val
            // size += Object.keys(data[parseInt(k)]).reduce((acc, cur) => {
            //     return acc + data[parseInt(k)][cur].length;
            // }, 0);
            k.cummulative = size;
            size += k.values.length;
            k.values.forEach((commit) => {
                // rangeBands.push(data[parseInt(k)][commit].length);
                rangeBands.push(`PR #${i}`); // ????
            });
        });
        let x_category = d3.scaleLinear().range([0, this.width]);

        // create dummy scale to get rangeBands (width/childrenValues)
        // let x_defect = d3
        //     .scaleOrdinal()
        //     // @ts-ignore
        //     .domain(rangeBands)
        //     .range([0, this.width]);

        let x_defect = d3
            .scaleBand()
            .domain(rangeBands)
            .range([0, this.width])
            .padding(0.1);

        // .rangeRoundBands([0, this.width], 0.1);
        var x_category_domain = x_defect.step() * rangeBands.length;
        x_category.domain([0, x_category_domain]);

        var category_g = svg
            .selectAll('.category')
            .data(formattedArray)
            .enter()
            .append('g')
            .attr('class', function (d: any) {
                return 'category category-' + d.key;
            })
            .attr('transform', function (d: any) {
                var x_group = x_category(d.cummulative * x_defect.step()); // Use x_defect.step() instead of x_defect.rangeBand()
                console.log('x x_group?', x_group, 'd?', d);
                return 'translate(' + x_group + ',0)';
            });

        const category_label = category_g
            .selectAll('.category-label')
            .data(function (d: any) {
                return [d];
            })
            .enter()
            .append('text')
            .attr('class', function (d: any) {
                return 'category-label category-label-' + d.key;
            })
            .attr('transform', function (d: any) {
                var x_label = x_category(
                    (d.values.length * x_defect.step() + barPadding) / 2
                ); // Use x_defect.step() instead of x_defect.rangeBand()
                var y_label = context.height + 30;
                return 'translate(' + x_label + ',' + y_label + ')';
            })
            .text(function (d: any) {
                return d.key;
            })
            .attr('text-anchor', 'middle');

        var defect_g = category_g
            .selectAll('.defect')
            .data(function (d: any) {
                return d.values;
            })
            .enter()
            .append('g')
            .attr('class', function (d: any) {
                return 'defect defect-' + d.key;
            })
            .attr('transform', function (d: any, i: any) {
                var x_defect_group = x_category(i * x_defect.step()); // Use x_defect.step() instead of x_defect.rangeBand()
                console.log('x defect?', x_defect_group);
                return 'translate(' + x_defect_group + ',0)';
            });

        var defect_label = defect_g
            .selectAll('.defect-label')
            .data(function (d: any) {
                console.log('DEFECT D', d);
                return [d];
            })
            .enter()
            .append('text')
            .attr('class', function (d: any) {
                return 'defect-label defect-label-' + d.key;
            })
            .attr('transform', function (d: any, i: any) {
                var x_label = x_category(
                    i * x_defect.step() + (x_defect.step() + barPadding) / 2
                ); // Use x_defect.step() instead of x_defect.rangeBand()
                var y_label = context.height + 10;
                return 'translate(' + x_label + ',' + y_label + ')';
            })
            .text(function (d: any) {
                return d.key;
            })
            .attr('text-anchor', 'middle');

        // svg.selectAll('.category-label')
        //     .data(formattedArray)
        //     .enter()
        //     .append('text')
        //     .attr('class', function (d) {
        //         return 'category-label category-label-' + d.key;
        //     })
        //     .attr('transform', function (d) {
        //         var x_label = x_category(
        //             (d.values.length * x_defect.step() + barPadding) / 2
        //         );
        //         var y_label = context.height + 30;
        //         return 'translate(' + x_label + ',' + y_label + ')';
        //     })
        //     .text(function (d) {
        //         return d.key;
        //     })
        //     .attr('text-anchor', 'middle');

        // // Append defect labels to the SVG
        // svg.selectAll('.defect-label')
        //     .data(function (d) {
        //         console.log('LABEL', d);
        //         return d.values.map(function (value) {
        //             return { key: d.key, value: value };
        //         });
        //     })
        //     .enter()
        //     .append('text')
        //     .attr('class', function (d) {
        //         return 'defect-label defect-label-' + d.key;
        //     })
        //     .attr('transform', function (d, i) {
        //         var x_label = x_category(
        //             i * x_defect.step() + (x_defect.step() + barPadding) / 2
        //         );
        //         var y_label = height + 10;
        //         return 'translate(' + x_label + ',' + y_label + ')';
        //     })
        //     .text(function (d) {
        //         return d.key;
        //     })
        //     .attr('text-anchor', 'middle');

        const y = d3
            .scaleLinear()
            // @ts-ignore
            .domain([
                0,
                d3.max(nonClustered, (d) => d._formattedData.y as number),
            ])
            .nice()
            .range([this.height - this.marginBottom, this.marginTop]);

        // var rects = defect_g
        //     .selectAll('.rect')
        //     .data(function (d) {
        //         return d.values.map(function (value) {
        //             return { key: d.key, value: value }; // Creating a new object for each value
        //         });
        //     })
        //     .enter()
        //     .append('rect')
        //     .attr('class', 'rect')
        //     .attr('width', x_category(x_defect.step() - barPadding)) // Use x_defect.step() instead of x_defect.rangeBand()
        //     .attr('x', function (d, i) {
        //         return x_category(i * x_defect.step() + barPadding); // Use x_defect.step() for positioning
        //     })
        //     .attr('y', function (d) {
        //         return y(d.value);
        //     })
        //     .attr('height', function (d) {
        //         return context.height - y(d.value);
        //     });

        // var rects = defect_g
        //     .selectAll('.rect')
        //     .data(function (d) {
        //         return d.values.map(function (value) {
        //             return { key: d.key, value: value };
        //         });
        //     })
        //     .enter()
        //     .append('rect')
        //     .attr('class', 'rect')
        //     .attr('width', x_category(x_defect.step() - barPadding))
        //     .attr('x', function (d, i) {
        //         return x_category(i * x_defect.step() + barPadding);
        //     })
        //     .attr('y', function (d) {
        //         return y(d.value);
        //     })
        //     .attr('height', function (d) {
        //         return context.height - y(d.value);
        //     });

        // Append the rects to the SVG
        svg.selectAll('.rect-group') // You can create a new group for rects if needed
            .data(formattedArray) // Use your main data array
            .enter()
            .append('g')
            .attr('class', 'rect-group')
            .attr('transform', function (d) {
                var x_group = x_category(parseInt(d.key) * x_defect.step()); // Adjust based on your data structure
                return 'translate(' + x_group + ',0)';
            })
            .selectAll('.rect') // Select all the rects within each group
            .data(function (d) {
                return d.values.map(function (value) {
                    console.log('d', d);
                    return { key: d.key, value: value };
                });
            })
            .enter()
            .append('rect')
            .attr('class', 'rect')
            .attr(
                'width',
                x_category(
                    x_defect.step() - barPadding < 0
                        ? 0
                        : x_defect.step() - barPadding
                )
            )
            .attr('x', function (d, i) {
                return x_category(i * x_defect.step() + barPadding);
            })
            .attr('y', function (d) {
                console.log('d', d);
                const val =
                    d.value[Object.keys(d.value)[0]][0]._formattedData.y;
                return y(val);
            })
            .attr('height', function (d) {
                const val =
                    d.value[Object.keys(d.value)[0]][0]._formattedData.y;
                return context.height - y(val);
            });
    }

    drawTimeline(origData: TimelineEvent[]) {
        const data = origData
            .sort((a, b) => a._formattedData.x - b._formattedData.x)
            .map((d) => {
                return {
                    date: this.strictIsoParse(
                        new Date(d._formattedData.x).toISOString()
                    ),
                    value: d._formattedData.y,
                    ...d,
                };
            });
        // console.log('data', data);
        const zoomed = (event: any) => {
            x.range(
                [this.marginLeft, this.width - this.marginRight].map((d) => {
                    return event.transform.applyX(d);
                })
            );

            focus
                .selectAll('.bars rect')
                // @ts-ignore
                .attr('x', (d) => x(d.date))
                .attr('width', x.bandwidth());
            focus.selectAll('.x-axis').call(xAxis);
        };

        const zoom = d3
            .zoom()
            .scaleExtent([1, 8])
            .translateExtent([
                [this.marginLeft, this.marginTop],
                [this.width - this.marginRight, this.height - this.marginTop],
            ])
            .extent([
                [this.marginLeft, this.marginTop],
                [this.width - this.marginRight, this.height - this.marginTop],
            ])
            .on('zoom', (event) => zoomed(event));

        const xAxis = (g: any) =>
            g
                .attr(
                    'transform',
                    `translate(0,${this.height - this.marginBottom})`
                )
                // @ts-ignore
                .call(d3.axisBottom(x).tickFormat(d3.timeFormat('%m/%d/%Y'))) // d3.timeFormat("%Hh")
                .selectAll('text')
                .style('text-anchor', 'end')
                .attr('dx', '-.8em')
                .attr('dy', '.15em')
                .attr('transform', 'rotate(-65)');

        const yAxis = (g: any) =>
            g
                .attr('transform', `translate(${this.marginLeft},0)`)
                .call(d3.axisLeft(y))
                .call((g: any) => g.select('.domain').remove());

        const svg = d3.select('svg');
        svg.selectAll('*').remove();
        // Specify the chart’s dimensions.
        const focus = svg.append('g').attr('class', 'focus');

        const x = d3
            .scaleBand()
            // @ts-ignore
            .domain(data.map((d) => d.date as Date))
            .range([this.marginLeft, this.width - this.marginRight])
            .padding(0.1);

        const y = d3
            .scaleLinear()
            // @ts-ignore
            .domain([0, d3.max(data, (d) => d.value as number)])
            .nice()
            .range([this.height - this.marginBottom, this.marginTop]);

        focus
            .append('g')
            .attr('class', 'bars')
            .selectAll('rect')
            .data(data)
            .join('rect')
            // @ts-ignore
            .attr('x', (d) => x(d.date as Date))
            .attr('y', (d) => y(d.value))
            .attr('height', (d) => y(0) - y(d.value))
            .attr('width', x.bandwidth())
            .attr('fill', (d: any) => this.getColor(d));

        focus.append('g').attr('class', 'x-axis').call(xAxis);
        focus.append('g').attr('class', 'y-axis').call(yAxis);

        svg.append('rect')
            .attr('class', 'zoom')
            .attr('pointer-events', 'all')
            .attr('fill', 'none')
            .attr('width', this.width - this.marginRight - this.marginLeft)
            .attr('height', this.height - this.marginBottom - this.marginTop)
            .attr(
                'transform',
                'translate(' + this.marginLeft + ',' + this.marginTop + ')'
            )
            // @ts-ignore
            .call(zoom);

        return svg.node();
    }

    groupLabels(data: TimelineEvent[]) {
        const groupedData: any = data.filter(
            (d) => d.getDataSourceType() === DataSourceType.META_PAST_VERSION
        );
    }
}

export default GraphController;

// // https://observablehq.com/@d3/icelandic-population-by-age-1841-2019?intent=fork
