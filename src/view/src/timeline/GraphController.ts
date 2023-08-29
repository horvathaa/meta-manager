import * as d3 from 'd3';
import TimelineController, { Payload } from './TimelineController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import { SerializedChangeBuffer, Event, DataSourceType } from '../types/types';
import { META_MANAGER_COLOR } from '../styles/globals';
// const color = d3.scaleOrdinal(
//     ['hJyV36Xgy8gO67UJVmnQUrRgJih1', 'ambear9@gmail.com'],
//     ['#4e79a7', '#e15759']
// );

function lightenDarkenColor(col: string, amt: number) {
    var usePound = false;

    if (col[0] == '#') {
        col = col.slice(1);
        usePound = true;
    }

    var num = parseInt(col, 16);

    var r = (num >> 16) + amt;

    if (r > 255) r = 255;
    else if (r < 0) r = 0;

    var b = ((num >> 8) & 0x00ff) + amt;

    if (b > 255) b = 255;
    else if (b < 0) b = 0;

    var g = (num & 0x0000ff) + amt;

    if (g > 255) g = 255;
    else if (g < 0) g = 0;

    return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
}

const source = d3.scaleOrdinal(
    ['git', 'vscode', 'CHAT_GPT', 'STACKOVERFLOW', 'GITHUB', 'pasted-code'],
    [
        '#4e79a761',
        META_MANAGER_COLOR,
        '#CCCCFF61',
        '#7575CF61',
        '#5453A661',
        '#9EA9ED61',
    ]
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
        const val = data.items // stupid bad
            ? this.drawTimeline(data.items)
            : this.drawTimeline(data);
        // const val = this.makeDynamicXAxis(data.prMap, data.items);
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
            .attr('text-anchor', 'middle')
            .attr('fill', 'white');

        var defect_g = category_g
            .selectAll('.defect')
            .data(function (d: any) {
                console.log('first data d defect', d);
                return d.values;
            })
            .enter()
            .append('g')
            .attr('class', function (d: any) {
                console.log('excuse ME!', d);
                const c = { key: Object.keys(d)[0].slice(0, 5) };
                return 'defect defect-' + c.key;
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
                // return [d];
                return [{ key: Object.keys(d)[0].slice(0, 5) }];
            })
            .enter()
            .append('text')
            .attr('class', function (d: any) {
                console.log('d OVER IN DEFECT LABEL', d);
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
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-65)')
            .attr('fill', 'white');

        const focus = svg.append('g').attr('class', 'focus');

        const y = d3
            .scaleLinear()
            // @ts-ignore
            .domain([
                0,
                d3.max(nonClustered, (d) => d._formattedData.y as number),
            ])
            .nice()
            .range([this.height - this.marginBottom, this.marginTop]);

        // Append the rects to the SVG
        // svg.selectAll('.rect-group') // You can create a new group for rects if needed
        defect_g
            .selectAll('.rect')
            // .data(formattedArray) // Use your main data array
            .data(function (d: any) {
                console.log('d here', d);
                return Object.keys(d).map(function (value) {
                    console.log('d', d);
                    return { key: value, value: d[value] };
                });
            })
            // .enter()
            // .append('g')
            // .attr('class', 'rect-group')
            // .attr('transform', function (d) {
            //     console.log('d here', d);
            //     var x_group = x_category(
            //         // parseInt(d.key) *
            //         x_defect.bandwidth()
            //     ); // Adjust based on your data structure
            //     return 'translate(' + x_group + ',0)';
            // })
            // .selectAll('.rect') // Select all the rects within each group
            // .data(function (d) {
            //     return d.values.map(function (value) {
            //         console.log('d', d);
            //         return { key: d.key, value: value };
            //     });
            // })
            // .enter()
            .join('rect')
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
                const val = d.value[0]._formattedData.y;
                return y(val);
            })
            .attr('height', function (d) {
                const val = d.value[0]._formattedData.y;
                return context.height - y(val);
            })
            .attr('fill', 'steelblue');
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
        const context = this;
        focus
            .append('g')
            .attr('class', 'bars')
            // .on('click', () => this.timelineController.renderMetadata())
            .selectAll('rect')
            .data(data)
            .join('rect')
            // @ts-ignore
            .attr('x', (d) => x(d.date as Date))
            .attr('y', (d) => y(d.value))
            .attr('height', (d) => y(0) - y(d.value))
            .attr('width', x.bandwidth())
            .attr('fill', (d: any) => this.getColor(d))
            .attr('id', (d: any) => d._formattedData.id.replace(/[:\s]+/g, '-'))
            .on('mouseover', function (e: any, k: any) {
                d3.select(this)
                    .transition()
                    .duration(300)
                    .attr('fill', lightenDarkenColor(context.getColor(k), 50))
                    .attr('cursor', 'pointer');
                // (this as Element).attr = 'pointer';
            })
            .on('mouseout', function (e: any, k: any) {
                d3.select(this)
                    .transition()
                    .duration(300)
                    .attr('fill', (d: any) => context.getColor(d));
            })
            .on('click', (e: any, k: any) => {
                console.log('CLICKED', e, k);
                this.timelineController._queue.push(k);
                this.timelineController.renderMetadata(k);
            })

            .enter();

        focus.append('g').attr('class', 'x-axis').call(xAxis);
        focus.append('g').attr('class', 'y-axis').call(yAxis);

        const overlay = svg
            .append('rect')
            .attr('class', 'zoom')
            // .attr('pointer-events', 'all')
            .attr('pointer-events', 'none')
            .attr('fill', 'none')
            .attr('width', this.width - this.marginRight - this.marginLeft)
            .attr('height', this.height - this.marginBottom - this.marginTop)
            .attr(
                'transform',
                'translate(' + this.marginLeft + ',' + this.marginTop + ')'
            );

        const zoomed = (event: any) => {
            overlay.style('pointer-events', 'all');
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
        // // @ts-ignore
        // .call(zoom);
        // @ts-ignore
        overlay.call(zoom);
        overlay.on('zoomend', () => {
            overlay.style('pointer-events', 'none');
        });

        return svg.node();
    }

    groupLabels(data: TimelineEvent[]) {
        const groupedData: any = data.filter(
            (d) => d.getDataSourceType() === DataSourceType.META_PAST_VERSION
        );
    }

    highlight(id: string, obj: any) {
        console.log(
            'id',
            `#${id.replace(/[:\s]+/g, '-')}`,
            'sel',
            d3.select(`#${id.replace(/[:\s]+/g, '-')}`)
        );
        d3.select(`#${id.replace(/[:\s]+/g, '-')}`)
            .transition()
            .duration(300)
            .attr(
                'fill',
                lightenDarkenColor(
                    this.getColor(obj), // sigh
                    50
                )
            );
    }

    unhighlight(id: string, obj: any) {
        d3.select(`#${id.replace(/[:\s]+/g, '-')}`)
            .transition()
            .duration(300)
            .attr('fill', this.getColor(obj));
    }

    postMessage(message: any) {
        window.postMessage(message, '*');
    }
}

export default GraphController;

// // https://observablehq.com/@d3/icelandic-population-by-age-1841-2019?intent=fork
