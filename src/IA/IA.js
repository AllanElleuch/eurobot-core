import * as util from 'util';

let Scheduler = require('../node-robot').Scheduler;
let log       = require('../libs/logger').getLogger(module);
let Button    = require('../io/Button');
let GpioPin   = require('../libs/GpioPin');


class IA {

    /**
     * Constructor
     *
     * @param modules modules
     */
    constructor(modules) {
        // Set modules
        this.motorController = modules.motorController;
        this.clampController = modules.clampController;
        // this.sensorsController = modules.sensorsController;

        // IO
        this.startButton = new Button(23, 'high');
        this.sideSelector = new GpioPin(12);

        this.scheduler = new Scheduler();
        this.actualGoTo = 0;

        /**
         * Events
         */

         // Start robot
        // this.startButton.once('start', () => {
        //     this.start();
        // });


        /**
         * Sequences
         */

         // Called on start
        this.mainSequence = this.scheduler.sequence((done) => {

            // Determine the start zone
            this.sideSelector.read()
                .then((level) => {
                    if (level === 'high') {
                        // Yellow side
                        this.yellowSequence.schedule();
                    }
                    else if (level === 'low') {
                        // Green side
                        this.greenSequence.schedule();
                    }

                    // this.sensorsController.previousDataState = 'low';

                    // Register sequence on sensor alert
                    // this.sensorsController.on('stop', () => {
                    //     log.warn('Obstacle detected');
                    //     this.motorController.stop();

                    //     this.scheduler.interrupt(() => {
                    //         // Schedule reaction sequence
                    //         this.scheduler
                    //             .sequence(function(done_) {
                    //                 done_();
                    //             })
                    //             .wait(() => {
                    //                log.debug('Reaction sequence !');

                    //                return this.sensorsController.previousDataState === 'high';
                    //             })
                    //             .do((done_) => {
                    //                 log.debug('finished');
                    //                 done_();
                    //             })
                    //             .schedule();
                    //     });
                    // });

                    done();
                })
                .catch((err) => {
                    log.error('Side selector error: ');
                    log.error(err.stack);
                    done();
                });
        });


        // Called on yellow side
        this.yellowSequence = this.scheduler.sequence((done) => {
            log.info('Yellow sequence started');

            this.motorController.goTo(0.6)
                .then(() => {
                    log.info('Arrived');
                    done();
                })
                .catch((err) => {
                    log.error('Cant goTo');
                    log.error(err.stack);
                    done();
                });
            })

        .after(0, (done) => {
            this.clampController.goTo('clamp', 2000)
                 .then(() => {
                    log.info('Object got');
                    done();
                 })
                 .catch((err) => {
                    log.error('Cant got object');
                    log.error(err.stack);
                    done();
                 });
        })

        .after(2000, (done) => {
            this.clampController.goTo('elev', 10000)
                 .then(() => {
                    log.info('Object elevated');
                    done();
                 })
                 .catch((err) => {
                    log.error('Cant elevate object');
                    log.error(err.stack);
                    done();
                 });
        })

        .after(5000, (done) => {
            this.motorController.turn(180)
                .then(() => {
                    log.info('Rotation finished');
                    done();
                })
                .catch((err) => {
                    log.error('Cant rotate');
                    log.error(err.stack);
                    done();
                });
        })
        .after(2000, (done) => {
            this.clampController.goTo('clamp', 1000);
            done();
        })

        .after(1000, (done) => {
            this.clampController.goTo('elev', 0)
                 .then(() => {
                    log.info('Object putted down');
                    done();
                 })
                 .catch((err) => {
                    log.error('Cant put down object');
                    log.error(err.stack);
                    done();
                 });
        })

        .after(0, (done) => {
            this.clampController.goTo('clamp', 0)
                 .then(() => {
                    log.info('Clamp open');
                    done();
                 })
                 .catch((err) => {
                    log.error('Cant open clamp object');
                    log.error(err.stack);
                    done();
                 });
        });

        // Called on green side
        this.greenSequence = this.scheduler.sequence((done) => {
            log.info('Green sequence started');

            this.motorController.goTo(1)
                .then(() => {
                    log.info('Arrived in 1');
                    done();
                })
                .catch((err) => {
                    log.error(err.stack);
                    done();
                });
        });
    }


    /**
     * Start IA
     */
    start() {
        // Schedule main sequence
        log.info('Robot started');
        this.mainSequence.schedule();
        this.scheduler.start();
    }

    /**
     * Stop IA
     */
    stop() {

    }
}


export default IA;

// 0.00803915411233902é
