import childProcess from 'child_process';


var sysExec = childProcess.exec;

/**
 * @brief Gpio pin manager that use the `gpio` command provided by wiring pi.
 */

class GpioPin {

    /**
     * @brief Constructor
     * @param pin - Pin number as writed on the Odroid-C1/RaspberryPi board directly
     */
    constructor(pin) {

        this.wiringToPin = {
            '7' : 7,
            '11' : 0,
            '13' : 2,
            '15' : 3,
            '19' : 12,
            '21' : 13,
            '23' : 14,
            '29' : 21,
            '31' : 22,
            '33' : 23,
            '35' : 24,
            '12' : 1,
            '16' : 4,
            '18' : 5,
            '22' : 6,
            '24' : 10,
            '26' : 11,
            '32' : 26,
            '36' : 27
        }

        if(pin in this.wiringToPin)
            this.wiringPin = this.wiringToPin[pin];
        else
        {
            this.wiringPin = -1;
            console.log('[WARN] The gpio pin ' + pin + ' is not usable')
        }
    }

    /**
     * @brief Set output or input mode of the pin
     * @param mode - 'out' or 'in'
     */
    mode(mode) {
        return new Promise((resolve, reject) =>
        {

            var execCallback = function (error, stdout, stderr)
            {
                if (error !== null) {
                    reject(error + ' : ' + stderr);
                }
                else
                    resolve(stdout);
            };

            if(mode == 'out')
                 sysExec('gpio mode ' + this.wiringPin + ' out', execCallback);
            else if(mode == 'in')
                 sysExec('gpio mode ' + this.wiringPin + ' in', execCallback);
        })
    }

    /**
     * @brief Set output value
     * @param level - 'high' or 'low'
     */
    write(level) {
        return new Promise((resolve, reject) =>
        {
            var execCallback = function (error, stdout, stderr)
            {
                if (error !== null) {
                    reject(error + ' : ' + stderr);
                }
                else
                    resolve(stdout);
            };

            if(level == 'high')
                 sysExec('gpio write ' + this.wiringPin + ' 1', execCallback);
            else if(level == 'low')
                 sysExec('gpio write ' + this.wiringPin + ' 0', execCallback);

        })
    }


    /**
     * @brief Read input value
     * @return in then promise the pin value 'high' or 'low'
     */
    read(level) {
        return new Promise((resolve, reject) =>
        {
            var execCallback = function (error, stdout, stderr)
            {
                if (error !== null) {
                    reject(error + ' : ' + stderr);
                }
                else
                {
                    if(stdout == 0)
                        resolve('low');
                    else if(stdout == 1)
                        resolve('high');
                    else
                        reject('No error but value returned by gpio command is not 0 or 1')
                }
            };

             sysExec('gpio read ' + this.wiringPin, execCallback);

        })
    }

}


export default GpioPin;
