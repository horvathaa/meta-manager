import { Slider } from '@mui/material';
import GraphController from './GraphController';
import * as React from 'react';

interface Props {
    range: [number, number];
    value: number;
    onChange?: (
        event: Event,
        value: number | number[],
        activeThumb: number
    ) => void;
    parent: GraphController;
}

const TimelineScrubber: React.FC<Props> = ({
    range: [min, max],
    value,
    onChange,
    parent,
}: Props) => {
    const handleScrubChange = (
        event: Event,
        value: number | number[],
        activeThumb: number
    ) => {
        console.log('what is HAPPENINGGGGGGGGGGGGGGG', value);
        const valToSend = Array.isArray(value) ? value[0] : value;
        parent.updateTimeline(valToSend);
    };
    console.log('min', min, 'max', max);
    return (
        // <div>very normal</div>
        <Slider
            min={min}
            max={max}
            defaultValue={0}
            step={1}
            marks
            // value={value}
            onChange={handleScrubChange}
        />
    );
};

export default TimelineScrubber;

// can restrict to interesting events given filter
{
    /* <Slider
  aria-label="Restricted values"
  defaultValue={20}
  valueLabelFormat={valueLabelFormat}
  getAriaValueText={valuetext}
  step={null}
  valueLabelDisplay="auto"
  marks={marks}
/> */
}
