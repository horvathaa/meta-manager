import { Slider, styled } from '@mui/material';
import GraphController from './GraphController';
import * as React from 'react';
import { WEB_INFO_SOURCE, Event } from '../types/types';

interface Props {
    range: [number, number];
    valueProp: number;
    parent: GraphController;
    events: any[];
    highlightTrack?: boolean;
}

export const prettyPrintType: { [k in WEB_INFO_SOURCE]: string } = {
    [WEB_INFO_SOURCE.CHAT_GPT]: 'Chat GPT',
    [WEB_INFO_SOURCE.VSCODE]: 'VS Code',
    [WEB_INFO_SOURCE.GITHUB]: 'GitHub',
    [WEB_INFO_SOURCE.STACKOVERFLOW]: 'Stack Overflow',
    [WEB_INFO_SOURCE.OTHER]: 'a web page',
};

const TimelineScrubber: React.FC<Props> = ({
    range: [min, max],
    valueProp,
    parent,
    events,
    highlightTrack = false,
}: Props) => {
    // const [value, setValue] = React.useState<number>(valueProp);
    const [value, setValue] = React.useState(valueProp);
    console.log('value!!!!!!!!!!!', value, 'valueprop', valueProp);

    React.useEffect(() => {
        setValue(valueProp);
    }, [valueProp]);

    const getMarks = (events: any[]) => {
        console.log('EVENTS!!!!!', events);
        const marks = events.map((event) => {
            let name = '';
            if (!event.eventData) {
                name = 'Search Result';
            } else {
                name = event.eventData;
                if (event.eventData[Event.WEB]) {
                    name =
                        prettyPrintType[
                            event.eventData[Event.WEB].copyBuffer
                                .type as WEB_INFO_SOURCE
                        ];
                } else if (event.eventData[Event.PASTE]) {
                    name = 'Pasted code';
                } else if (event.eventData[Event.COPY]) {
                    name = 'Copied code';
                }
            }
            return {
                value: event.idx,
                label: (
                    <div
                        onClick={(e) => {
                            handleScrubChange(e, event.idx, 0);
                            setValue(event.idx);
                        }}
                    >
                        {name}
                    </div>
                ),
            };
        });
        return marks;
    };

    const handleScrubChange = (
        event: any,
        valueArg: number | number[],
        activeThumb: number
    ) => {
        const valToSend = Array.isArray(valueArg) ? valueArg[0] : valueArg;

        if (event.shiftKey) {
            parent.filterToTime(valToSend);
        }
        setValue(valToSend);
        parent.updateTimeline(valToSend);
    };

    const sx = {
        ...{
            '& .MuiSlider-markLabel': {
                color: 'white',
                /* Rotate from top left corner (not default) */
                transformOrigin: [0, 0],
                transform: 'rotate(90deg)',
                fontSize: 'x-small',
                // display: 'none',
                opacity: '50%',
                '&:focus, &:hover, &.Mui-active': {
                    display: 'block',
                    opacity: '100%',
                },
            },
            '& .MuiSlider-mark': {
                height: '8px',
            },
        },
        ...(highlightTrack && {
            '& .MuiSlider-rail': {
                backgroundColor: '#d69756a8',
            },
        }),
    };
    console.log('min', min, 'max', max);
    return (
        <Slider
            min={min}
            max={max - 2}
            defaultValue={0}
            step={1}
            marks={getMarks(events)}
            value={value}
            onChange={handleScrubChange}
            sx={sx}
            // onChangeCommitted={handleScrubChange}
            // onBlur={handleBlur}
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
