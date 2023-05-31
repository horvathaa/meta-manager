import TimelinesChart from 'timelines-chart';
const el = document.getElementById('root');
if (el) {
    const chart = TimelinesChart();

    chart.data([
        {
            group: 'group1name',
            data: [
                {
                    label: 'label1name',
                    data: [
                        {
                            timeRange: [1685541200925, 1685541234757],
                            val: 'str1',
                        },
                        {
                            timeRange: [1685541199925, 1685541200925],
                            val: 'str2',
                        },
                    ],
                },
            ],
        },
    ])(el);
    console.log('chart', chart);
} else {
    console.error('No element found');
}
