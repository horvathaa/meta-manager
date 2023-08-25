import * as d3 from 'd3';
import TimelineController, { Payload } from './TimelineController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import { SerializedChangeBuffer, Event } from '../types/types';

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
        const val = this.lastOnePlease(data.items);
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
    lastOnePlease(origData: TimelineEvent[]) {
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
}

export default GraphController;

// // https://observablehq.com/@d3/icelandic-population-by-age-1841-2019?intent=fork
