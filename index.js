const http = require('http');
const msgpack = require('msgpack5')();

const Parser = require("binary-parser").Parser;
var ipHeader = new Parser()
    .endianess("little")
    .bit4("version")
    .bit4("headerLength")
    .uint8("tos")
    .uint16("packetLength")
    .uint16("id")

const BUFFER = {};

function existsKey(key) {
    return (typeof BUFFER[key] == 'object');
}

function getBuffer(mac) {
    if (!BUFFER[mac]) {
        BUFFER[mac] = {mac, history: [], status: 0};
    }
    return BUFFER[mac];
}

function addRecord(mac, record) {
    let buffer = getBuffer(mac);
    buffer.history.push(record);
    if (buffer.history.length > 8) {
        buffer.history.shift();
    }
    return buffer;
}

function changeStatus(mac, status) {
    let buffer = getBuffer(mac);
    buffer.status = status;
    return buffer;
}

const arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length


const server = http.createServer((req, res) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
    });

    req.on('end', () => {
            let data = null;
            switch (chunks.length) {
                case 0:
                    data = chunks[0];
                    break;
                case 1:
                    data = chunks[0];
                    break;
                default:
                    data = new Buffer(size);
                    for (let i = 0, pos = 0, len = chunks.length; i < len; i++) {
                        const chunk = chunks[i];
                        chunk.copy(data, pos);
                        pos += chunk.length;
                    }
                    break;
            }

            if (data == null) {
                return;
            }

            let time = new Date().getTime();
            data = msgpack.decode(data);
            for (let device of data.devices) {
                // console.log(device);
                if (device[0] == 0 || device[0] == 3) {
                    let mac = device.slice(1, 7).toString('hex');
                    let rssi = device[7] - 256;
                    let data = device.slice(8, device.length);
                    let majorMinor = data.slice(data.length - 2, data.length).toString('hex');
                    let distance = 0.42093 * Math.pow((rssi / -59), 6.9476) + 0.54992;
                    // 2. let distance = 0.42093 * Math.pow((rssi / -50), 6.9476) + 0.54992;
                    // 1. let distance = 0.42093 * Math.pow((rssi / -50), 6.9476) + 0.54992;
                    // if (mac == '749ae4d10df9') {
                    // if (mac == 'd7c593ade99e') {
                    if (mac == 'decb8e412ba0' && majorMinor == 'c101') {
                        // TODO enter, last 5 meter is outside
                        getBuffer(mac);
                        let buffer = addRecord(mac, rssi);

                        const avg = arrAvg(buffer.history);
                        let avgDistance = 0.42093 * Math.pow((avg / -59), 6.9476) + 0.54992;

                        let newStatus = 0;
                        if (avgDistance < 0.8) {
                            newStatus = 1;
                        }
                        if (buffer.status != newStatus) {
                            buffer.status = newStatus;
                            console.log('change status', newStatus, '\n');
                        }
                        // console.log(time, mac, majorMinor, rssi, distance, avg, avgDistance);
                        let str = [time, mac, majorMinor, rssi, distance, avg, avgDistance].join(',');
                        process.stdout.write(str + '\r');

                        // process.stdout.write(rssi + '\r');

                        // console.log(avg, buffer.history);

                        // TODO exit
                    }
                }
            }
            res.end('post')
        }
    );
});

server.listen(8000);
