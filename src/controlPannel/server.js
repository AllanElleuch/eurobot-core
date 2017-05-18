import util from 'util';
import path from 'path';
import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import tmxParser from 'tmx-parser';
import promisify from 'native-promisify';
import logger from '../libs/logger';


let app       = express().use(express.static(path.join(__dirname, 'public')));
let server    = promisify(http.Server(app), ['listen']);
let io        = socketIO(server);
let tmx       = promisify(tmxParser);

// Manual control vars
let keyStatus = {};
let pwmStatus = { left : 0, right : 0 };
let clampStatus =
{
  elev : { move : false, up : false },
  clamp : { move : false, up : false }
};
let clampTimeout = { elev : null, clamp : null };
const PWM_LEFT_COEF = 1.3;

/**
 * Socket io is set up, we can pass the object
 * to the logger module
 */

logger.initIO(io);
let log = logger.getLogger(module);
let modules = null;

const UPDATE_STATUS_PERIOD = 3000; //ms


let port = 8080;
let data = {
  distance: {
    kp: 0.9,
    ki: 0,
    kd: 0.1
  },
  orientation: {
    kp: 2.3,
    ki: 0,
    kd: 0.25
  },
  dt: 50,
  items: [
    // ['ball',     'Balle',     100],
    // ['cylinder', 'Cylindre',  200],
    // ['bottle',   'Bouteille', 300],
    // ['cube',     'Cube',      400]
  ]
};

let forceMotorUpdate = true;
let forceClampUpdate = true;
let forceSensorUpdate = true;

io.on('connection', function(socket) {
    log.info('[WEB] New client connected');

    forceMotorUpdate = true;
    forceClampUpdate = true;
    forceSensorUpdate = true;

    /*
      Setup handlers
     */

    socket
      .on('disconnect', function() {
        log.info('[WEB] Client disconnected');
      })
      .on('control', function(key) {
        // Update key status
        keyStatus[key.action] = key.pressed;

        // Calculate new pwm and new clamp status
        let newPwm = { left : 0, right : 0 };
        let newClamp =
        {
          elev : { move : false, up : false },
          clamp : { move : false, up : false }
        };

        if(keyStatus.forward) {
          newPwm.left += 100;
          newPwm.right += 100;
        }
        if(keyStatus.backward) {
          newPwm.left -= 100;
          newPwm.right -= 100;
        }
        if((keyStatus.turnRight && !keyStatus.backward) ||
            (keyStatus.turnLeft && keyStatus.backward)) {
          newPwm.left += 80;
          newPwm.right -= 60;
        }
        if((keyStatus.turnLeft && !keyStatus.backward) ||
            (keyStatus.turnRight && keyStatus.backward)) {
          newPwm.right += 80;
          newPwm.left -= 60;
        }
        if(keyStatus.clampUp)
        {
          newClamp.elev.move = true;
          newClamp.elev.up = true;
        }
        if(keyStatus.clampDown)
        {
          newClamp.elev.move = true;
          newClamp.elev.up = false;
        }
        if(keyStatus.clampClose)
        {
          newClamp.clamp.move = true;
          newClamp.clamp.up = true;
        }
        if(keyStatus.clampOpen)
        {
          newClamp.clamp.move = true;
          newClamp.clamp.up = false;
        }

        // Apply coef to pwm and check maximums
        newPwm.left = Math.floor(newPwm.left * PWM_LEFT_COEF);
        if(newPwm.left > 255) {
          newPwm.left = 255;
        }
        if(newPwm.right > 255) {
          newPwm.right = 255;
        }
        if(newPwm.left < -255) {
          newPwm.left = -255;
        }
        if(newPwm.right < -255) {
          newPwm.right = -255;
        }

        // Update pwm value if needed
        if(pwmStatus.left !== newPwm.left) {
          pwmStatus.left = newPwm.left;
          modules.motorController.run('left', newPwm.left);
        }
        if(pwmStatus.right !== newPwm.right) {
          pwmStatus.right = newPwm.right;
          modules.motorController.run('right', newPwm.right);
        }

        // Update clamp elevator status
        if(clampStatus.elev.move !== newClamp.elev.move ||
          clampStatus.elev.up !== newClamp.elev.up) {
          clampStatus.elev = newClamp.elev;
          if(clampStatus.elev.move) {
            if(clampStatus.elev.up) {
              clearTimeout(clampTimeout.elev);
              modules.clampController.goTo('elev', 2000000000);
            }
            else {
              clearTimeout(clampTimeout.elev);
              modules.clampController.goTo('elev', -2000000000);
            }
          }
          else {
            modules.clampController.stop('elev');
            clearTimeout(clampTimeout.elev);
            clampTimeout.elev = setTimeout(function() {
              modules.clampController.stop('elev');
            }, 1000);
          }
        }

        // Update clamp status
        if(clampStatus.clamp.move !== newClamp.clamp.move ||
          clampStatus.clamp.up !== newClamp.clamp.up) {
          clampStatus.clamp = newClamp.clamp;
          if(clampStatus.clamp.move) {
            if(clampStatus.clamp.up) {
              clearTimeout(clampTimeout.clamp);
              modules.clampController.goTo('clamp', 2000000000); //2147483647
            }
            else {
              clearTimeout(clampTimeout.clamp);
              modules.clampController.goTo('clamp', -2000000000); //214747 3647
            }
          }
          else {
            modules.clampController.stop('clamp');
            clearTimeout(clampTimeout.clamp);
            clampTimeout.clamp = setTimeout(function() {
              modules.clampController.stop('clamp');
            }, 1000);
          }
        }
      })

      .on('stopMotor', function() {
        log.info('stopMotor request');

        modules.motorController
          .stop()
          .then(() => {
            log.info('Motors stopped');
          })
          .catch((err) => {
            log.warn('stopMotor: ' + err.message);
          });
      })

      .on('goToMotor', function(data) {
        log.info('goToMotor request');

        modules.motorController
          .goTo(data.distance)
          .then(() => {
            log.info('Arrived');
          })
          .catch((err) => {
            log.warn('goToMotor: ' + err.message);
          });
      })

      .on('runMotor', function(data) {
        modules.motorController.run(data.motor, data.pwm)
          .then(() => {
            // log.info(util.format('%s run at %d', data.motor, data.pwm));
          })
          .catch((err) => {
            log.warn('runMotor: ' + err.message);
          });
      })

      .on('turnMotor', function(data) {
        modules.motorController.turn(data.angle)
          .then(() => {
            log.info(util.format('Tun %d', data.angle));
          })
          .catch((err) => {
            log.warn('turnMotor: ' + err.message);
          });
      })

      .on('setTunings', function(data) {
        modules.motorController.setTunings(data.orientation, data.distance, data.dt)
          .then(() => {
            log.info('Tunings set');
          })
          .catch((err) => {
            log.warn('setTunings: ' + err.message);
          })
      })

      .on('resetOdometry', function() {
        modules.motorController.setOdometry({x: 0, y: 0}, 0)
          .then(() => {
            log.info('Odometry reset');
          })
          .catch((err) => {
            log.warn('resetOdometry: ' + err.message);
          })
      })

      .on('entraxeStart', function() {
        modules.motorController.startEntraxe()
          .then(() => {
            log.info('startEntraxe');
          })
          .catch((err) => {
            log.warn('startEntraxe: ' + err.message);
          })
      })

      .on('entraxeStop', function() {
        modules.motorController.stopEntraxe()
          .then((entraxe) => {
            io.sockets.emit('entraxeValue', { entraxe: entraxe });
          })
          .catch((err) => {
            log.warn('stopEntraxe: ' + err.message);
          })
      })
      .on('eval', function(data) {
        /*
          Shortcuts
         */

        let help = 'Not yet !';
        let m = modules;

        try {
          log.info('[EVAL]: ' + eval(data));
        }
        catch(err) {
          log.warn('[EVAL]: ' + err.message);
        }
      })
      /*
        Step motors/Clamp
      */
      .on('stepGetpos', function(data) {
        modules.clampController.updatePosition()
        .catch((err) =>{log.warn('stepGetPos: ' + err.message);});
      })
      .on('stepGoto', function(data) {
        modules.clampController.goTo(data.motor, data.pos)
        .catch((err) =>{log.warn('stepGoTo: ' + err.message);});
      })
      .on('stepStop', function(data) {
        modules.clampController.stop(data.motor)
        .catch((err) =>{log.warn('stepStop: ' + err.message);});
      })
      .on('stepInit', function(data) {
        modules.clampController.init(data.motor)
        .catch((err) =>{log.warn('stepInit: ' + err.message);});
      });


    /*
      Init interface
     */

    data.messages = logger.getHistory();
    socket.emit('init', data);

    // tmx.parseFile(path.join(__dirname, 'public/ROBOT.tmx'))
    //   .then(function(map) {
    //     for(key in map.layers[0].tiles) {
    //       if(map.layers[1].tiles[key]) collclip = map.layers[1].tiles[key].id;
    //       else collclip = null;

    //       if(collclip) {
    //         map.layers[0].tiles[key] = {
    //           id: map.layers[0].tiles[key].id,
    //           collclip: collclip
    //         }
    //       } else {
    //         map.layers[0].tiles[key] = {
    //           id: map.layers[0].tiles[key].id
    //         }
    //       }
    //     }
    //     socket.emit('map', {map: {width: map.width, height:map.height, tileWidth: map.tileWidth, tileHeight: map.tileHeight}, tiles: map.layers[0].tiles, tileSet: map.tileSets[0]});
    //   })
    //   .catch(function(err) {
    //     log.error('[MAP]: ' + err.message);
    //   });
});


/**
 * Start the webServer
 */

function start(modules_) {
    return server.listen(port);
}

function bind(modules_) {
    modules = modules_;

    if (modules.motorController)
    {
      // Odometry updates
      // modules.motorController.on('newPosition', function() {
      //   io.sockets.emit('getPosition', modules.motorController.getPosition());
      // });

      // Update status icons
      let motorStatus = false;
      // setInterval(() => {
      //   modules.motorController.isAlive()
      //   .then(() => {
      //     if(!motorStatus || forceMotorUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'motor', status : true});
      //       motorStatus = true;
      //       forceMotorUpdate = false;
      //     }
      //   })
      //   .catch((err) => {
      //     if(motorStatus || forceMotorUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'motor', status : false});
      //       motorStatus = false;
      //       forceMotorUpdate = false;
      //     }
      //   });
      // }, UPDATE_STATUS_PERIOD);

    }

    if (modules.clampController)
    {
      // Odometry updates
      modules.clampController.on('clampPos', function(data) {
        io.sockets.emit('clampPos', data);
      });

      //Update status icons
      let clampStatus = false;
      // setInterval(() => {
      //   modules.clampController.isAlive()
      //   .then(() => {
      //     if(!clampStatus || forceClampUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'clamp', status : true});
      //       clampStatus = true;
      //       forceMotorUpdate = false;
      //     }
      //   })
      //   .catch((err) => {
      //     if(clampStatus || forceClampUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'clamp', status : false});
      //       clampStatus = false;
      //       forceMotorUpdate = false;
      //     }
      //   });
      // }, UPDATE_STATUS_PERIOD);
    }

    if (modules.sensorsController)
    {
      // Update status icons
      let sensorStatus = false;
      // setInterval(() => {
      //   modules.sensorsController.isAlive()
      //   .then(() => {
      //     if(!sensorStatus || forceSensorUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'sensor', status : true});
      //       sensorStatus = true;
      //       forceSensorUpdate = false;
      //     }
      //   })
      //   .catch(() => {
      //     if(sensorStatus || forceSensorUpdate) {
      //       io.sockets.emit('updateStatus', {board : 'sensor', status : false});
      //       sensorStatus = false;
      //       forceSensorUpdate = false;
      //     }
      //   });
      // }, UPDATE_STATUS_PERIOD);
    }
}


export default {
  start: start,
  bind: bind
};
