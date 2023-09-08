import * as d3 from 'd3';
import TimelineController, { Payload, theme } from './TimelineController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import styles from '../styles/timeline.module.css';
import {
    VSCodeButton,
    VSCodeCheckbox,
    VSCodeRadio,
    VSCodeRadioGroup,
    VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {
    SerializedChangeBuffer,
    Event,
    DataSourceType,
    CopyBuffer,
} from '../types/types';
import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import TimelineScrubber from './Scrubber';
import {
    META_MANAGER_COLOR,
    META_MANAGER_COLOR_LIGHT,
    lightenDarkenColor,
} from '../styles/globals';
import CodeBlock from '../components/CodeBlock';
import Version from './Version';
import { Button, IconButton } from '@mui/material';
import { CancelOutlined } from '@mui/icons-material';
import Search from './Search';
// const color = d3.scaleOrdinal(
//     ['hJyV36Xgy8gO67UJVmnQUrRgJih1', 'ambear9@gmail.com'],
//     ['#4e79a7', '#e15759']
// );

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

const lightenOrd = d3.scaleOrdinal(
    ['git', 'vscode', 'CHAT_GPT', 'STACKOVERFLOW', 'GITHUB', 'pasted-code'],
    [
        '#4e79a7',
        META_MANAGER_COLOR_LIGHT,
        '#CCCCFF',
        '#7575CF',
        '#5453A6',
        '#9EA9ED',
    ]
);

class GraphController {
    private readonly width = 1000;
    private readonly height = 500;
    private readonly marginTop = 20;
    private readonly marginRight = 30;
    private readonly marginBottom = 30;
    private readonly marginLeft = 60;
    private readonly totalWidth = window.innerWidth;
    _keyMap: { [k: string]: any }[] = [];
    _currIndex: number = 0;
    _focusedIndex: number = 0;
    _currKey: string = '';
    _scrubberRef: Root;
    _infoRef: Root;
    _headerRef: Root;
    _filtered: boolean = false;
    _filterRange: [number, number] = [0, 0];
    _searchTerm: string = '';
    _canonicalEvents: SerializedChangeBuffer[] = [];
    chart: any;

    constructor(private readonly timelineController: TimelineController) {
        this._scrubberRef = createRoot(
            document.getElementById('scrubberRoot') ||
                document.createElement('div')
        );
        this._infoRef = createRoot(
            document.getElementById('infoRoot') || document.createElement('div')
        );
        const header =
            document.getElementById('header') || document.createElement('div');
        this._headerRef = createRoot(header);
    }

    renderHeader() {
        return (
            <div className={styles['flex']}>
                <div className={styles['center']} style={{ margin: 'auto' }}>
                    <h1>
                        {this._keyMap[this._currIndex]?.scale.otherInfo.global
                            .filename || ''}
                    </h1>
                </div>
                <Search context={this} />
                <div style={{ marginLeft: 'auto' }}>
                    {this._keyMap.length ? (
                        <>{this.getHighLevelSummary()}</>
                    ) : null}
                    {/* <VSCodeButton
                    className={styles['m2']}
                    onClick={() => {
                        // this._queue.push(undefined);
                        this._ref.render(
                            <ThemeProvider theme={theme}>
                                <Card style={cardStyle}>
                                    {this.renderNode()}
                                </Card>
                            </ThemeProvider>
                        );
                    }}
                >
                    Home
                </VSCodeButton>
                <VSCodeButton
                    className={styles['m2']}
                    appearance="secondary"
                    disabled={!this._queue.length}
                    onClick={() => this.renderMetadata(this._queue.pop())}
                >
                    Back
                </VSCodeButton> */}
                </div>
            </div>
        );
    }

    getHighLevelSummary() {
        const { scale } = this._keyMap[this._currIndex];
        const { otherInfo } = scale;
        const time = `From ${new Date(
            scale.xMin
        ).toLocaleString()} to ${new Date(scale.xMax).toLocaleString()}, ${
            otherInfo.global.user
        } made ${scale.length} edits.`;
        const summaries = [];
        Object.keys(otherInfo).forEach((k) => {
            if (k !== 'global') {
            }
        });
        return <div></div>;
    }

    getColor(d: TimelineEvent, lighten?: boolean) {
        if (d._dataSourceType === 'git') {
            return lighten
                ? lightenOrd(d._dataSourceType)
                : source(d._dataSourceType);
        } else if (d._dataSourceType === 'meta-past-version') {
            const data = d.originalData as SerializedChangeBuffer;
            if (data.eventData) {
                if (data.eventData[Event.WEB]) {
                    return lighten
                        ? lightenOrd(data.eventData[Event.WEB].copyBuffer.type)
                        : source(data.eventData[Event.WEB].copyBuffer.type);
                }
                if (data.eventData[Event.PASTE]) {
                    return lighten
                        ? lightenOrd('pasted-code')
                        : source('pasted-code'); // should get a better type for this
                }
            }
        }

        return lighten ? lightenOrd('vscode') : source('vscode');
    }

    constructGraph(data: any, keys: string[], windowed: any[], keyMap: any) {
        // const val = data.items // stupid bad
        //     ? this.drawTimeline(data.items)
        //     : this.drawTimeline(data);
        const val = this.drawStream(data, keys, windowed, keyMap);
        // const val = this.makeDynamicXAxis(data.prMap, data.items);
        return val;
    }

    filterToTime(idx: number) {
        console.log('lol', this._keyMap[this._currIndex]);
        const filteredRange: [number, number] =
            idx > this._focusedIndex
                ? [this._focusedIndex, idx]
                : [idx, this._focusedIndex];
        this.drawStream(
            [], // nightmare
            [],
            [],
            this._keyMap,
            filteredRange
        );
        this._filterRange = filteredRange;
        this._filtered = true;
    }

    drawStream(
        data: SerializedChangeBuffer[],
        keys: string[],
        windowed: any[],
        keyMap: { [k: string]: any }[],
        range?: [number, number]
    ) {
        const svg = d3.select('svg');
        svg.selectAll('*').remove();

        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const chartWidth = this.width - margin.left - margin.right;
        const chartHeight = this.height - margin.top - margin.bottom;
        this._keyMap = keyMap;
        const g = svg
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        console.log('CALLING DRAW STREAM');

        const scale = keyMap[0]['scale'];

        range && console.log('range!!!!', range);
        var xscale = range
            ? d3
                  .scaleLinear() // Use linear scale for x
                  .range([0, chartWidth]) // Adjust the range for horizontal orientation
                  .domain([0, range[1] - range[0]]) // ????
            : d3
                  .scaleLinear() // Use linear scale for x
                  .range([0, chartWidth]) // Adjust the range for horizontal orientation
                  .domain([0, scale.length]); // Time never < 0
        // .domain(d3.extent(windowed, (w) => w.end))

        const yscale = d3
            .scaleLinear()
            .range([0, chartHeight])
            .domain([scale.yMax, 0])
            .nice();
        // const xvalues = test[0].x; // .map((e) => xscale(e));

        // Create X and Y Axes
        // if (scale.xMax - scale.xMin < 2880000) {
        //     const xAxis = d3
        //         .axisBottom(xscale)
        //         .tickFormat(d3.timeFormat('%b %d'));
        //     g.append('g')
        //         .attr('class', 'x-axis')
        //         .attr('transform', `translate(0, ${chartHeight})`)
        //         .call(xAxis);
        // }
        // @ts-ignore
        const xAxis = d3
            .axisBottom(xscale)
            .ticks(chartWidth / 80)
            .tickSizeOuter(0);
        const yAxis = d3.axisLeft(yscale);

        // Append X Axis
        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${chartHeight})`)
            // @ts-ignore
            .call(xAxis);

        // Append Y Axis
        g.append('g').attr('class', 'y-axis').call(yAxis);

        // Label X Axis
        g.append('text')
            .attr('class', 'x-label')
            .attr('x', chartWidth / 2)
            .attr('y', chartHeight + margin.bottom)
            .style('text-anchor', 'middle');
        // .text('X Axis Label');

        // Label Y Axis
        g.append('text')
            .attr('class', 'y-label')
            .attr('x', -chartHeight / 2)
            .attr('y', -margin.left)
            .attr('transform', 'rotate(-90)')
            .style('text-anchor', 'middle');
        // .text('Y Axis Label');

        const events: any[] = [];
        Object.keys(keyMap[this._currIndex])
            .filter((k) => k !== 'scale')
            .forEach((k, ix) => {
                const test = keyMap[this._currIndex][k];
                if (!this._currKey.length) {
                    this._currKey = k;
                }
                events.push(...test[1].events);

                let upperYScale = test[0].y;
                let lowerYScale = test[1].y;
                if (range) {
                    upperYScale = test[0].y.slice(range[0], range[1]);
                    lowerYScale = test[1].y.slice(range[0], range[1]);
                }
                const indexies = d3.range(lowerYScale.length);
                // range &&
                //     console.log(
                //         'indexies',
                //         indexies,
                //         'upper',
                //         upperYScale,
                //         'lower',
                //         lowerYScale,
                //         'real data',
                //         test[1].data.slice(
                //             range ? range[0] : 0,
                //             range ? range[1] : test[1].data.length
                //         )
                //     );
                const area = d3
                    .area()
                    .curve(d3.curveMonotoneX)
                    .x((d, i) => {
                        // return xscale(test[1].x[i]);
                        // if (range) {
                        //     if (i < range[0] || i > range[1]) {
                        //         return 0;
                        //     }
                        // }
                        return xscale(i);
                    })
                    .y0((d, i) => {
                        // range && console.log('lowerYScale', lowerYScale[i]);
                        return yscale(lowerYScale[i]);
                    })
                    .y1((d, i) => {
                        return yscale(upperYScale[i]);
                    });
                const colorArr = [
                    'lightsteelblue',
                    'pink',
                    'steelblue',
                    'white',
                ];
                // const xs = test[0].x.map((e: any) => xscale(e));
                // console.log('huh?', xs);
                // var div = d3
                //     .select('body')
                //     .append('div')
                //     .attr('class', 'tooltip-donut')
                //     .style('opacity', 0);
                svg.append('path')
                    // .data(test)
                    .datum(indexies)
                    .attr('class', 'area')
                    .attr('fill', colorArr[ix])
                    .attr(
                        'transform',
                        `translate(${margin.left}, ${margin.top})`
                    )
                    // @ts-ignore
                    .attr('d', area);
                // .on('mousemove', function (d, i) {
                //     const [xm, ym] = d3.pointer(d);
                //     console.log('ahhhhh - xm', xm, 'xy', ym, 'xs', xs);
                //     const closestInstance = xs.findIndex((x: number) => {
                //         // console.log('x', x);
                //         return x > xm;
                //     });
                //     const instance = test[1].data[closestInstance];
                //     // console.log('instance', instance);
                //     // console.log('hewwo?', closestInstance, test[1].data[closestInstance]);
                //     d3.select(this)
                //         .transition()
                //         .duration(50)
                //         .attr('opacity', '.85');
                //     div.transition().duration(50).style('opacity', 1);
                //     // console.log('d', d, 'i?', i, 'area??', area);
                //     let num = d;
                //     // div.html(num)
                //     //     .style('left', d3.event.pageX + 10 + 'px')
                //     //     .style('top', d3.event.pageY - 15 + 'px');
                // })
                // .on('mouseout', function (d, i) {
                //     d3.select(this)
                //         .transition()
                //         .duration(50)
                //         .attr('opacity', '1');
                //     div.transition().duration(50).style('opacity', 0);
                // });

                const line = d3
                    .line()
                    .curve(d3.curveCardinal)
                    .x(function (d, i) {
                        // console.log('d!', d);
                        return xscale(d[0]);
                    })
                    .y(function (d, i) {
                        return yscale(d[1]);
                    });
            });
        this._canonicalEvents = events;
        this._scrubberRef.render(
            <TimelineScrubber
                range={range ? range : [0, scale.length]}
                valueProp={0}
                parent={this}
                events={events}
            />
        );
        this._headerRef.render(this.renderHeader());
    }

    pointerentered(e: any, k: any) {
        console.log('POINTER ENTERED!!!!!!!!', e, k);
        // path.style('mix-blend-mode', null).style('stroke', '#ddd');
        // dot.attr('display', null);
        this.timelineController.renderMetadata(k);
    }

    search(searchTerm: string) {
        const dataRange: [number, number] = this._filtered
            ? this._filterRange
            : [0, this._keyMap[this._currIndex].scale.length];
        if (!searchTerm.length) {
            // this._filtered = false;
            // this._filterRange = [0, 0];
            this._searchTerm = '';
            this.drawStream(
                [], // nightmare
                [],
                [],
                this._keyMap,
                this._filtered ? this._filterRange : undefined
            );
            this._scrubberRef.render(
                <TimelineScrubber
                    range={dataRange}
                    valueProp={0}
                    parent={this}
                    events={this._canonicalEvents}
                />
            );
            return;
        }
        const data: SerializedChangeBuffer[] = [];
        const arr: any[] = [];
        const idx: number[] = [];

        Object.keys(this._keyMap[this._currIndex])
            .filter((k) => {
                return k !== 'scale';
            })
            .forEach((k) => {
                const arrayToFilter = this._filtered
                    ? this._keyMap[this._currIndex][k][1].data.slice(
                          this._filterRange[0],
                          this._filterRange[1]
                      )
                    : this._keyMap[this._currIndex][k][1].data;
                arr.push(
                    ...arrayToFilter.filter(
                        (d: SerializedChangeBuffer, i: number) => {
                            console.log('d', d);
                            if (d && d.location.content.includes(searchTerm)) {
                                this._filtered
                                    ? idx.push(i + this._filterRange[0])
                                    : idx.push(i);
                                return true;
                            }
                            // return (
                            //      // &&
                            //     // d.changeContent.includes(searchTerm) &&
                            //     // d.changeContent.trim() !== d.location.content.trim()
                            // );
                        }
                    )
                );
                // const events = k[1].events;
                // events.forEach((e) => {
                //     if (
                //         e.eventData &&
                //         e.eventData[Event.WEB] &&
                //         e.eventData[Event.WEB].copyBuffer
                //     ) {
                //         const copyBuffer =
                //             e.eventData[Event.WEB].copyBuffer;
                //         if (
                //             copyBuffer.code.includes(searchTerm) ||
                //             copyBuffer.pasteContent.includes(searchTerm)
                //         ) {
                //             data.push(e);
                //         }
                //     }
                // });
            });
        console.log('arr?', arr, idx);
        this._scrubberRef.render(
            <TimelineScrubber
                range={dataRange}
                valueProp={0}
                parent={this}
                events={arr.map((d) => {
                    return {
                        ...d,
                        idx: idx.shift(),
                        eventData: `${searchTerm}`,
                    };
                })}
            />
        );
        this._searchTerm = searchTerm;
        // this.drawStream(
        //     data, // nightmare
        //     [],
        //     [],
        //     this._keyMap
        // );
    }

    updateTimeline(value: number) {
        const data: SerializedChangeBuffer[] = [];
        this._focusedIndex = value;
        Object.keys(this._keyMap[this._currIndex])
            .filter((k) => {
                return k !== 'scale';
            })
            .forEach((k) => {
                console.log(
                    'value',
                    value,
                    'k',
                    k,
                    'entry',
                    this._keyMap[this._currIndex][k][1]
                );
                if (this._keyMap[this._currIndex][k][1].data[value]) {
                    data.push(this._keyMap[this._currIndex][k][1].data[value]);
                }
                // const instance = test[1].data[closestInstance];
            });
        console.log('instances!!!!!!!!!!!', data, 'value', value);
        this._infoRef.render(
            <>
                {this._filtered ? (
                    <IconButton
                        onClick={() => {
                            this._filtered = false;
                            this._filterRange = [0, 0];
                            this.drawStream(
                                [], // nightmare
                                [],
                                [],
                                this._keyMap
                            );
                        }}
                        sx={{
                            color: 'whitesmoke',
                            position: 'absolute',
                            right: '50px',
                        }}
                    >
                        <CancelOutlined />
                    </IconButton>
                ) : null}
                <div>
                    {data.map((d, i) => (
                        <Version version={d} key={d.id + i} context={this} />
                    ))}
                </div>
            </>
        );
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
                // console.log('excuse ME!', d);
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
                    .attr('fill', context.getColor(k, true))
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
        d3.select(`#${id.replace(/[:\s]+/g, '-')}`)
            .transition()
            .duration(300)
            .attr('fill', this.getColor(obj, true));
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
