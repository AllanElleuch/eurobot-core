import Packet from './Packet';


const PACKET_NUMBER = 3;
const PACKET_LENGTH = 0;


/**
 * Stop motors and enslavement
 */
class MotorStopPacket extends Packet {

    constructor() {
        super();

        this.packetNumber = PACKET_NUMBER;
        this.packetLength = PACKET_LENGTH;
    }


    serialize() {
        let data = new Buffer(this.packetLength);
        return data;
    }


    deserialize(data) {
        // Send packet only with no response
        return null;
    }
}


export default MotorStopPacket;