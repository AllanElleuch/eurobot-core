import EventEmitter from 'events';
import packetsByNumber from './packets/';
import GpioPin from '../libs/GpioPin';
import PromiseQueue from 'promise-queue';


let promisify = require('native-promisify');
let i2c       = require('i2c-bus');
let util      = require('util');
let log       = require('../libs/logger').getLogger(module);


/**
 * Interface with I2C module
 */
class Communication extends EventEmitter {

    /**
     * Constructor
     * @param  {String} address motorController I²C address
     * @param  {Byte} dataAvaiblePin Pin that well be up when data is up on slave
     */
    constructor(address, dataAvailablePin) {
        super();

        this.address = address;
        this.dataAvailablePin = new GpioPin(dataAvailablePin);
        this.bus = null;
        this.queue = new PromiseQueue(1, Infinity);

        this.lastRcvCheck = -1;

        this.dataAvailablePin.mode('out');
        this.previousDataState = 'low';

        this.lastValidAnswere = 0;

        // Constantly update dataAvailable state
        setInterval(() => {
            this.dataAvailablePin.read()
                .then((level)  => {
                    // Emit only RISING event
                    if (level === 'high' &&
                        this.previousDataState === 'low') {
                        this.emit('data');
                    }

                    this.previousDataState = level;
                });
        }, 100);
    }

    /**
     * Open an I2C connection on the given address
     */
    open() {
        // Open cannot be promisified
        this.bus = promisify(i2c.openSync(1), ['i2cWrite', 'i2cRead', 'close']);

    }


    /**
     * Close I2C connection
     * @return {Promise} Promise object
     */
    close() {
        return this.bus.close();
    }

    send(packet) {
        return this.queue.add(() => {
            return this.sendBuffer(packet);
        });
    }

    /**
     * Send a packet
     * @param  {Packet} packet Packet to send
     */
    sendBuffer(packet) {
        let newCheck;
        let header = new Buffer(2);

        let packetNumber = packet.getPacketNumber();
        // Write packet identifier
        header.writeUInt8(packetNumber, 0);

        let data = packet.serialize();

        // Write data length
        header.writeUInt8(data.length, 1);

        // Calculate check byte
        newCheck = packetNumber;
        newCheck ^= data.length;
        for (let i = 0; i < data.length; i++)
        {
            newCheck ^= data.readUInt8(i);
        }

        // New check is stored in order to verify next response
        this.lastRcvCheck = newCheck;

        let frame = Buffer.concat([ header, data, new Buffer([newCheck]) ]);

        if (this.bus) {
            return this.bus.i2cWrite(this.address, frame.length, frame);
        }
        else {
            return Promise.reject(new Error('Bus non open'));
        }
    }


    /**
     * Read data on slave
     * @param  {Int} packetNumber packet number to read
     * @return {Promise} Promise object
     */
    request(packetNumber) {
        // Some black magic to provide undefined amount of arguments
        let args = [null].concat(Array.prototype.slice.call(arguments, 1));
        let constructor = packetsByNumber[packetNumber];
        let packetFactory = constructor.bind.apply(constructor, args);

        let packet = new packetFactory();

        let frame = new Buffer(32).fill(0);


        // Send request packet
        return new Promise((resolve, reject) => {
            this.sendBuffer(packet)
            .then(() => {
                // When perfomance become an issue...
                return new Promise((resolve_, reject_) => {
                    setTimeout(() => {
                        this.bus.i2cRead(this.address, frame.length, frame)
                        .then(() => {
                            resolve_();
                        })
                        .catch((err) => {
                            reject_(err);
                        });
                    }, 1);
                });
                // return this.bus.i2cRead(this.address, frame.length, frame)
            })
            .then(() => {
                // console.log(frame);
                let offset = 0;
                let newCheck;

                // Read last check byte
                let lastCheck = frame.readUInt8(offset);
                offset++;

                // Compare last check byte
                if (!lastCheck === this.lastRcvCheck) {
                    throw new Error("Last check not valid: " + lastCheck + " vs " + this.lastRcvCheck);
                }

                // Read packet length
                let length = frame.readUInt8(offset);
                offset++;
                newCheck = length;

                if (length > 32) {
                    // Impossible
                    throw new Error('Packet dropped. Length too long.');
                }

                // Read arguments
                let data = new Buffer(length);

                for (let i = 0; i < length; i++) {
                    let value = frame.readUInt8(offset);

                    data.writeUInt8(value, i);
                    newCheck ^= value;
                    offset++;
                }

                // Compare new check byte
                if (newCheck === frame.readUInt8(offset)) {
                    packet.deserialize(data);

                    this.lastValidAnswere = (new Date()).getTime();
                    resolve(packet);
                }
                else {
                    reject(new Error("Check not valid: " + newCheck + " vs " + frame.readUInt8(offset)));
                }
            })
            .catch((err) => {
                reject(err);
            });
        });
    }
}

export default Communication;