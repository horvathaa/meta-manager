import * as d3 from 'd3';

const color = d3.scaleOrdinal(
    ['hJyV36Xgy8gO67UJVmnQUrRgJih1', 'ambear9@gmail.com'],
    ['#4e79a7', '#e15759']
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

    constructor() {
        // this.constructGraph(data);
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*
    // https://observablehq.com/@d3/pannable-chart?intent=fork
    *otherPopulate(
        data: any,
        svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
        x: d3.ScaleTime<number, number, never>,
        y: d3.ScaleLinear<number, number, never>
    ) {
        console.log('are u silently failing idk what yielding does', data);
        const area = d3
            .area()
            .curve(d3.curveStep)
            // @ts-ignore
            .x((d) => {
                console.log('d', d);
                // @ts-ignore
                return x(d._formattedData.x);
            })
            .y0(y(0))
            // @ts-ignore
            .y1((d) => y(d._formattedData.y));
        // Create a div that holds two svg elements: one for the main chart and horizontal axis,
        // which moves as the user scrolls the content; the other for the vertical axis (which
        // doesn’t scroll).
        const parent = d3.create('div');

        // Create the svg with the vertical axis.
        parent
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('z-index', 1)
            .append('g')
            .attr('transform', `translate(${this.marginLeft},0)`)
            .call(d3.axisLeft(y).ticks(6))
            .call((g) => g.select('.domain').remove())
            .call((g) =>
                g
                    .select('.tick:last-of-type text')
                    .clone()
                    .attr('x', 3)
                    .attr('text-anchor', 'start')
                    .attr('font-weight', 'bold')
                    .text('$ Close')
            );

        // Create a scrolling div containing the area shape and the horizontal axis.
        const body = parent
            .append('div')
            .style('overflow-x', 'scroll')
            .style('-webkit-overflow-scrolling', 'touch');

        console.log('body', body, 'svg', svg, 'parent', parent);
        // @ts-ignore
        // svg = body
        //     .append('svg')
        //     .attr('width', this.totalWidth)
        //     .attr('height', this.height)
        //     .style('display', 'block');

        // svg.append('g')
        //     .attr(
        //         'transform',
        //         `translate(0,${this.height - this.marginBottom})`
        //     )
        //     .call(
        //         d3
        //             .axisBottom(x)
        //             .ticks(d3.utcMonth.every(1200 / this.width))
        //             .tickSizeOuter(0)
        //     );

        svg.append('path')
            .datum(data)
            .attr('fill', 'steelblue')
            .attr('d', area);

        console.log('wtf', parent.node());
        yield parent.node();

        // Initialize the scroll offset after yielding the chart to the DOM.
        return body.node()?.scrollBy(this.totalWidth, 0);
    }

    // https://observablehq.com/@d3/icelandic-population-by-age-1841-2019?intent=fork
    populateGraph(
        data: any,
        svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
        x: d3.ScaleTime<number, number, never>,
        y: d3.ScaleLinear<number, number, never>
    ) {
        // svg.append('g').call(xAxis);

        // svg.append('g').call(yAxis);

        const group = svg.append('g');

        let rect = group.selectAll('rect');

        console.log('hewwwooo????', data);
        // @ts-ignore
        return Object.assign(svg.node(), {
            update(event: any) {
                // const dx = (x.step() * (year - yearMin)) / yearStep;

                console.log('event???', event);
                const t = svg.transition().ease(d3.easeLinear).duration(3000);

                rect = rect
                    .data(
                        // data.items.filter((d: any) => d.year === event),
                        data.items,
                        (d: any) => `${d.val}:${d.uid}`
                    )
                    .join(
                        (enter) =>
                            enter
                                .append('rect')
                                .style('mix-blend-mode', 'darken')
                                .attr('fill', (d: any) => color(d.uid))
                                .attr('x', (d: any) => x(d.x) + 100)
                                .attr('y', (d: any) => y(d.y))
                                .attr('width', 100)
                                .attr('height', 0),
                        (update) => update,
                        (exit) =>
                            exit.call((rect) =>
                                rect
                                    .transition(t)
                                    .remove()
                                    .attr('y', y(0))
                                    .attr('height', 0)
                            )
                    );

                rect.transition(t)
                    .attr('y', (d: any) => y(d.y))
                    .attr('height', (d: any) => y(0) - y(d.y));

                group.transition(t).attr('transform', `translate(${-1000},0)`);
            },
        });
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
}

export default GraphController;
