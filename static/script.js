'use strict';


// ============================================================
// DEVICE CONFIGURATION
// ============================================================

const DEVICES = {

    light1: {
        name: 'Living Room Light',
        type: 'light'
    },

    light2: {
        name: 'Laboratory Light',
        type: 'light'
    },

    light3: {
        name: 'Entrance Light',
        type: 'light'
    },

    door: {
        name: 'Main Door',
        type: 'door'
    }

};


const stateCache = {

    light1: 'OFF',
    light2: 'OFF',
    light3: 'OFF',
    door: 'CLOSED'

};


let pollRunning = false;
let commandRunning = false;


// ============================================================
// HELPER
// ============================================================

function getElement(id) {

    return document.getElementById(id);

}


// ============================================================
// UPDATE ONE DEVICE
// ============================================================

function updateDevice(
    deviceId,
    rawState
) {

    const device =
        DEVICES[deviceId];


    if (!device) {
        return;
    }


    const state =
        String(
            rawState ?? ''
        )
        .trim()
        .toUpperCase();


    let active = false;

    let displayState =
        state;


    // --------------------------------------------------------
    // DOOR
    // --------------------------------------------------------

    if (device.type === 'door') {

        if (
            state === 'ON' ||
            state === 'OPEN'
        ) {

            active = true;
            displayState = 'OPEN';

        } else if (
            state === 'OFF' ||
            state === 'CLOSED'
        ) {

            active = false;
            displayState = 'CLOSED';

        } else {

            displayState = 'UNKNOWN';

        }

    }

    // --------------------------------------------------------
    // LIGHT
    // --------------------------------------------------------

    else {

        if (state === 'ON') {

            active = true;
            displayState = 'ON';

        } else if (state === 'OFF') {

            active = false;
            displayState = 'OFF';

        } else {

            displayState = 'UNKNOWN';

        }

    }


    stateCache[
        deviceId
    ] = displayState;


    // --------------------------------------------------------
    // GET ELEMENTS
    // --------------------------------------------------------

    const stateElement =
        getElement(
            `state-${deviceId}`
        );


    const dotElement =
        getElement(
            `dot-${deviceId}`
        );


    const cardElement =
        getElement(
            `card-${deviceId}`
        );


    if (stateElement) {

        stateElement.textContent =
            displayState;

    }


    if (dotElement) {

        dotElement
            .classList
            .toggle(
                'active',
                active
            );

    }


    if (cardElement) {

        cardElement
            .classList
            .toggle(
                'active',
                active
            );

    }

}


// ============================================================
// UPDATE MQTT / DASHBOARD BADGE
// ============================================================

function setDashboardOnline(
    online
) {

    const badge =
        getElement(
            'mqtt-badge'
        );


    if (!badge) {
        return;
    }


    if (online) {

        badge.textContent =
            '● DASHBOARD ONLINE';


        badge
            .classList
            .remove(
                'offline'
            );


        badge
            .classList
            .add(
                'online'
            );

    } else {

        badge.textContent =
            '● CONNECTION ERROR';


        badge
            .classList
            .remove(
                'online'
            );


        badge
            .classList
            .add(
                'offline'
            );

    }

}


// ============================================================
// GET ALL DEVICE STATES
// ============================================================

async function updateStates() {

    if (pollRunning) {
        return;
    }


    pollRunning = true;


    try {

        const response =
            await fetch(
                '/devices/state',
                {
                    cache:
                        'no-store'
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        // ----------------------------------------------------
        // UPDATE DEVICES
        // ----------------------------------------------------

        updateDevice(
            'light1',
            data.light1?.state
        );


        updateDevice(
            'light2',
            data.light2?.state
        );


        updateDevice(
            'light3',
            data.light3?.state
        );


        updateDevice(
            'door',
            data.door?.state
        );


        setDashboardOnline(
            true
        );


        // ----------------------------------------------------
        // OPTIONAL INFORMATION
        // ----------------------------------------------------

        updateOptionalInformation();


    } catch (error) {

        console.error(
            'Unable to update device states:',
            error
        );


        setDashboardOnline(
            false
        );

    } finally {

        pollRunning =
            false;

    }

}


// ============================================================
// SEND DEVICE COMMAND
// ============================================================
//
// Supports both:
//
// sendCommand('/light1/on')
//
// AND:
//
// sendCommand('light1', 'on')
//
// ============================================================

async function sendCommand(
    deviceOrUrl,
    action = null
) {

    if (commandRunning) {

        console.log(
            'Another command is currently running.'
        );

        return;
    }


    let url;


    // --------------------------------------------------------
    // URL PROVIDED DIRECTLY
    // --------------------------------------------------------

    if (
        typeof deviceOrUrl === 'string' &&
        deviceOrUrl.startsWith('/')
    ) {

        url =
            deviceOrUrl;

    }

    // --------------------------------------------------------
    // DEVICE + ACTION
    // --------------------------------------------------------

    else {

        const device =
            deviceOrUrl;


        if (!DEVICES[device]) {

            console.error(
                'Unknown device:',
                device
            );

            return;
        }


        // Door
        if (
            device === 'door'
        ) {

            if (
                action !== 'open' &&
                action !== 'close'
            ) {

                return;

            }


            url =
                `/door/${action}`;

        }

        // Lights
        else {

            if (
                action !== 'on' &&
                action !== 'off'
            ) {

                return;

            }


            url =
                `/${device}/${action}`;

        }

    }


    commandRunning =
        true;


    disableControlButtons(
        true
    );


    try {

        const response =
            await fetch(
                url,
                {
                    cache:
                        'no-store'
                }
            );


        if (!response.ok) {

            throw new Error(
                `Command failed: HTTP ${response.status}`
            );

        }


        const result =
            await response.json();


        console.log(
            'Command response:',
            result
        );


        // MQTT message has to travel through
        // broker and return to Flask.
        await delay(
            300
        );


        await updateStates();


    } catch (error) {

        console.error(
            'Command error:',
            error
        );


        alert(
            `Unable to send command.\n${error.message}`
        );

    } finally {

        commandRunning =
            false;


        disableControlButtons(
            false
        );

    }

}


// ============================================================
// DISABLE BUTTONS DURING COMMAND
// ============================================================

function disableControlButtons(
    disabled
) {

    const buttons =
        document.querySelectorAll(
            '.device-actions button'
        );


    buttons.forEach(
        button => {

            button.disabled =
                disabled;

        }
    );

}


// ============================================================
// OPTIONAL DASHBOARD INFORMATION
// ============================================================

function updateOptionalInformation() {

    // --------------------------------------------------------
    // LIGHTS ON COUNT
    // --------------------------------------------------------

    const lightsOn =
        [
            'light1',
            'light2',
            'light3'
        ]
        .filter(
            device =>
                stateCache[device] === 'ON'
        )
        .length;


    const lightsCounter =
        getElement(
            'lightsOnCount'
        );


    if (lightsCounter) {

        lightsCounter.textContent =
            String(
                lightsOn
            )
            .padStart(
                2,
                '0'
            );

    }


    // --------------------------------------------------------
    // DOOR SUMMARY
    // --------------------------------------------------------

    const doorSummary =
        getElement(
            'doorSummary'
        );


    if (doorSummary) {

        doorSummary.textContent =
            stateCache.door;

    }


    // --------------------------------------------------------
    // LAST UPDATED
    // --------------------------------------------------------

    const lastUpdated =
        getElement(
            'lastUpdated'
        );


    if (lastUpdated) {

        lastUpdated.textContent =
            `Updated ${
                new Date()
                    .toLocaleTimeString(
                        [],
                        {
                            hour:
                                '2-digit',

                            minute:
                                '2-digit',

                            second:
                                '2-digit'
                        }
                    )
            }`;

    }

}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const clock =
        getElement(
            'clock'
        );


    if (!clock) {
        return;
    }


    clock.textContent =
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour:
                        '2-digit',

                    minute:
                        '2-digit'
                }
            );

}


// ============================================================
// DELAY
// ============================================================

function delay(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// ============================================================
// OPTIONAL DATA-CONTROL BUTTON SUPPORT
// ============================================================

document
    .querySelectorAll(
        '[data-control]'
    )
    .forEach(
        button => {

            button.addEventListener(
                'click',
                () => {

                    sendCommand(
                        button.dataset.control,
                        button.dataset.action
                    );

                }
            );

        }
    );


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        updateClock();

        updateStates();


        // Clock update
        setInterval(
            updateClock,
            30000
        );


        // MQTT / device state update
        setInterval(
            updateStates,
            1500
        );

    }
);