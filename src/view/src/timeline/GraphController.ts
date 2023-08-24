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
    private readonly height = 400;
    private readonly marginTop = 20;
    private readonly marginRight = 20;
    private readonly marginBottom = 30;
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

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*
    // https://observablehq.com/@d3/pannable-chart?intent=fork
    *otherPopulate(
        data: any,
        svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
        x: d3.ScaleTime<number, number, never>,
        y: d3.ScaleLinear<number, number, never>
    ) {
        const points = data.map((d: any) => [
            x(d._formattedData.x),
            y(d._formattedData.y),
            d,
        ]);
        const group = svg.append('g');

        let rect = group.selectAll('rect');
        rect = rect.data(data).join(
            (enter) =>
                enter
                    .append('rect')
                    .style('mix-blend-mode', 'darken')
                    .attr('fill', (d: any) => {
                        return this.getColor(d);
                    })
                    .attr('x', (d: any) => {
                        console.log('d', d);
                        return x(d._formattedData.x); // + 100;
                    })
                    .attr('y', (d: any) => y(d._formattedData.y))
                    .attr('height', (d: any) => y(0) - y(d._formattedData.y))
                    .attr('width', 10)
                    .on('mouseover', (e, d) => this.pointerentered(e, d))
                    .on('mouseout', (e, d) => this.pointerleft(e, d)),
            (update) => update,
            (exit) =>
                exit.call((rect) =>
                    rect
                        .transition(
                            svg.transition().ease(d3.easeLinear).duration(3000)
                        )
                        .remove()
                        .attr('y', y(0))
                        .attr('height', 0)
                )
        );

        // rect.on('pointerenter', () => this.pointerentered())
        // svg.on('pointermove', (e) => this.pointermoved(e, points, svg)).on(
        //     'pointerleft',
        //     () => this.pointerleft()
        // );
    }

    constructGraph(data: any) {
        // Declare the x (horizontal position) scale.
        const x = d3
            .scaleUtc()
            // @ts-ignore
            .domain(d3.extent(data.items, (d) => d._formattedData.x))
            .range([this.marginLeft, this.width - this.marginRight]);

        // Declare the y (vertical position) scale.
        const y = d3
            .scaleLinear()
            // @ts-ignore
            .domain([0, d3.max(data.items, (d) => d._formattedData.y)])
            .range([this.height - this.marginBottom, this.marginTop]);

        const svg = d3.select('svg');
        svg.selectAll('*').remove();
        // Create the SVG container.
        svg.attr('width', this.width).attr('height', this.height);

        // Add the x-axis.
        svg.append('g')
            .attr(
                'transform',
                `translate(0,${this.height - this.marginBottom})`
            )
            .call(d3.axisBottom(x));

        // Add the y-axis.
        svg.append('g')
            .attr('transform', `translate(${this.marginLeft},0)`)
            .call(d3.axisLeft(y));

        // this.chart = this.populateGraph(data, svg, x, y);
        // this.chart.update(data.items[data.items.length - 1]._formattedData);
        const gen = this.otherPopulate(data.items, svg, x, y);
        const val = gen.next().value;
        console.log('wtf', val);
        return val;
        // return svg.node();
    }

    pointermoved(
        event: any,
        points: any[],
        svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>
    ) {
        // const [xm, ym] = d3.pointer(event);
        // console.log('xm', xm, 'ym', ym);
        // const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
        // // @ts-ignore
        // const [x, y, k] = points[i];
        // console.log('i', i, 'x', x, 'y', y, 'k', k);
        // // path.style('stroke', ({ z }) => (z === k ? null : '#ddd'))
        // //     .filter(({ z }) => z === k)
        // //     .raise();
        // // dot.attr('transform', `translate(${x},${y})`);
        // // dot.select('text').text(k);
        // // svg.property('value', unemployment[i]).dispatch('input', {
        // //     bubbles: true,
        // // });
        // svg.dispatch('input', { bubbles: true });
        // this.timelineController.renderMetadata(k);
    }

    pointerentered(e: any, k: any) {
        console.log('POINTER ENTERED!!!!!!!!', e, k);
        // path.style('mix-blend-mode', null).style('stroke', '#ddd');
        // dot.attr('display', null);
        this.timelineController.renderMetadata(k);
    }

    pointerleft(e: any, k: any) {
        console.log('POINTER LEFT!!!!!!!!', e, k);
        this.timelineController.renderMetadata(undefined);
        // path.style('mix-blend-mode', 'multiply').style('stroke', null);
        // dot.attr('display', 'none');
        // svg.node().value = null;
        // svg.dispatch('input', { bubbles: true });
    }
}

export default GraphController;

// // https://observablehq.com/@d3/icelandic-population-by-age-1841-2019?intent=fork
// populateGraph(
//     data: any,
//     svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
//     x: d3.ScaleTime<number, number, never>,
//     y: d3.ScaleLinear<number, number, never>
// ) {
//     // svg.append('g').call(xAxis);

//     // svg.append('g').call(yAxis);

//     const group = svg.append('g');

//     let rect = group.selectAll('rect');

//     console.log('hewwwooo????', data);
//     // @ts-ignore
//     return Object.assign(svg.node(), {
//         update(event: any) {
//             // const dx = (x.step() * (year - yearMin)) / yearStep;

//             console.log('event???', event);
//             const t = svg.transition().ease(d3.easeLinear).duration(3000);

//             rect = rect
//                 .data(
//                     // data.items.filter((d: any) => d.year === event),
//                     data.items,
//                     (d: any) => `${d.val}:${d.uid}`
//                 )
//                 .join(
//                     (enter) =>
//                         enter
//                             .append('rect')
//                             .style('mix-blend-mode', 'darken')
//                             .attr('fill', (d: any) => color(d.uid))
//                             .attr('x', (d: any) => x(d.x) + 100)
//                             .attr('y', (d: any) => y(d.y))
//                             .attr('width', 100)
//                             .attr('height', 0),
//                     (update) => update,
//                     (exit) =>
//                         exit.call((rect) =>
//                             rect
//                                 .transition(t)
//                                 .remove()
//                                 .attr('y', y(0))
//                                 .attr('height', 0)
//                         )
//                 );

//             rect.transition(t)
//                 .attr('y', (d: any) => y(d.y))
//                 .attr('height', (d: any) => y(0) - y(d.y));

//             group.transition(t).attr('transform', `translate(${-1000},0)`);
//         },
//     });
// }
