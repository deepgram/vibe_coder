'use strict';
const isMac = require('os').type() == 'Darwin';
const isWin = require('os').type().indexOf('Windows') > -1;
const spawn = require('child_process').spawn;
const EventEmitter = require('events');

class Microphone extends EventEmitter {
    constructor(options) {
        super();
        this.ps = null;

        options = options || {};
        this.endian = options.endian || 'little';
        this.bitwidth = options.bitwidth || '16';
        this.encoding = options.encoding || 'signed-integer';
        this.rate = options.rate || '16000';
        this.channels = options.channels || '1';
        this.additionalParameters = options.additionalParameters || false;
        this.useDataEmitter = !!options.useDataEmitter;
        if (isWin) {
            this.device = options.device || 'default';
        }
        if (!isWin && !isMac) {
            this.device = options.device || 'plughw:1,0';
            this.format = undefined;
            this.formatEndian = undefined;
            this.formatEncoding = undefined;

            if (this.encoding === 'unsigned-integer') {
                this.formatEncoding = 'U';
            } else {
                this.formatEncoding = 'S';
            }
            if (this.endian === 'big') {
                this.formatEndian = 'BE';
            } else {
                this.formatEndian = 'LE';
            }
            this.format =
                this.formatEncoding + this.bitwidth + '_' + this.formatEndian;
        }
    }

    // end on silence - default threshold 0.5
    //'silence', '1', '0.1', options.threshold + '%',
    //'1', '1.0', options.threshold + '%'

    startRecording() {
        let audioOptions;
        if (this.ps === null) {
            if (isWin) {
                audioOptions = [
                    '-b',
                    this.bitwidth,
                    '--endian',
                    this.endian,
                    '-c',
                    this.channels,
                    '-r',
                    this.rate,
                    '-e',
                    this.encoding,
                    '-t',
                    'waveaudio',
                    this.device,
                    '-p',
                ];
                if (this.additionalParameters) {
                    audioOptions = audioOptions.concat(
                        this.additionalParameters
                    );
                }
                this.ps = spawn('sox', audioOptions);
            } else if (isMac) {
                audioOptions = [
                    '-q',
                    '-b',
                    this.bitwidth,
                    '-c',
                    this.channels,
                    '-r',
                    this.rate,
                    '-e',
                    this.encoding,
                    '-t',
                    'wav',
                    '-',
                ];
                if (this.additionalParameters) {
                    audioOptions = audioOptions.concat(
                        this.additionalParameters
                    );
                }
                this.ps = spawn('rec', audioOptions);
            } else {
                audioOptions = [
                    '-c',
                    this.channels,
                    '-r',
                    this.rate,
                    '-f',
                    this.format,
                    '-D',
                    this.device,
                ];
                if (this.additionalParameters) {
                    audioOptions = audioOptions.concat(
                        this.additionalParameters
                    );
                }
                this.ps = spawn('arecord', audioOptions);
            }
            this.ps.on('error', (error) => {
                this.emit('error', error);
            });
            this.ps.stderr.on('error', (error) => {
                this.emit('error', error);
            });
            this.ps.stderr.on('data', (info) => {
                this.emit('info', info);
            });
            if (this.useDataEmitter) {
                this.ps.stdout.on('data', (data) => {
                    this.emit('data', data);
                });
            }
            return this.ps.stdout;
        }
    }

    stopRecording() {
        if (this.ps) {
            this.ps.kill();
            this.ps = null;
        }
    }
}

module.exports = Microphone;
