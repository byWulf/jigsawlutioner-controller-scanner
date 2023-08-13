import childProcess from 'child_process';

export default new class Libcamera {
    isInitialized = false;
    currentCameraResolver = null;
    readyCallback = null;
    cameraProcess = null;
    buffer = null;
    startTime = 0;

    currentParameters = null;

    parameters = [
        '-t', '0', // Time (in ms) for which program runs
        '-s', // Perform capture when signal received
        '--shutter', '10000', // Set a fixed shutter speed
        '-o', '-', // Set the output file name
        '--gain', '0', // Set a fixed gain value
        '--sharpness', '1',
        '--contrast', '1',
        '--brightness', '0',
        '--saturation', '2',
        '--awb', 'indoor',
        '--denoise', 'off',
        '--thumb', 'none',
        '-q', '80', // Jpg quality
        '-n', // Do not show a preview window
        '-e', 'jpg', // Encoding
    ];

    // jpg
    startBytes = Buffer.from([0xff, 0xd8]);
    endBytes = Buffer.from([0xff, 0xd9]);

    // png
    // startBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // endBytes = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);


    /**
     * @return {Promise<void>}
     */
    init(left, right, top, bottom, width) {
        return new Promise((resolve) => {
            if (this.isInitialized) {
                resolve();
                return;
            }

            const parameters = [...this.parameters];
            let resizeFactor = 0.75;
            if (left || right || top || bottom) {
                parameters.push('--roi');
                parameters.push(left + ',' + top + ',' + (right - left) + ',' + (bottom - top))
                resizeFactor = 0.75 * ((bottom - top) / (right - left));
            }
            if (width) {
                parameters.push('--width', width);
                let height = Math.round(width * resizeFactor);
                parameters.push('--height', height + (height % 2));
            }

            this.cameraProcess = childProcess.spawn('libcamera-still', parameters);

            this.cameraProcess.stdout.on('data', (data) => {
                this.handleImageData(data);
            });

            this.cameraProcess.stderr.on('data', (data) => {
                console.error(data.toString());

                if (data.toString().indexOf('Still capture image received') > -1 && typeof this.readyCallback === 'function') {
                    this.readyCallback();
                    this.readyCallback = null;
                }
            });
            this.cameraProcess.on('close', () => {
                console.log('Camera closed!');
            });

            setTimeout(() => {
                this.isInitialized = true;
                resolve();
            }, 2000);
        });
    };

    /**
     * @param {Buffer} data
     */
    handleImageData(data) {
        if (this.buffer === null) {
            this.buffer = data;
        } else {
            this.buffer = Buffer.concat([this.buffer, data]);
        }

        let openings = 1;
        let currentPosition = this.startBytes.length;
        do {
            let nextStart = this.buffer.indexOf(this.startBytes, currentPosition);
            let nextEnd = this.buffer.indexOf(this.endBytes, currentPosition);

            if (nextEnd === -1) {
                return;
            }
            if (nextStart === -1 || nextEnd < nextStart) {
                currentPosition = nextEnd + this.endBytes.length;
                openings--;
            } else {
                currentPosition = nextStart + this.startBytes.length;
                openings++;
            }
        } while (openings > 0);


        let finishedImageBuffer = this.buffer.slice(0, currentPosition);
        this.buffer = this.buffer.slice(currentPosition);

        if (this.currentCameraResolver !== null) {
            console.log('Taking image took ' + (Date.now() - this.startTime) + 'ms (buffer length ' + this.buffer.length + ' remaining)');

            this.currentCameraResolver(finishedImageBuffer);
        }

        // Look if there is another image in the same stream already
        this.handleImageData(Buffer.from(''));
    };

    /**
     * @return {Promise<Buffer>}
     */
    takeImage(left, right, top, bottom, width, readyCallback) {
        return new Promise(async (resolve) => {
            if (this.isInitialized && this.currentParameters !== left + '_' + right + '_' + top + '_' + bottom + '_' + width) {
                this.cameraProcess.kill('SIGINT');
                this.cameraProcess = null;
                this.isInitialized = false;
            }
            if (!this.isInitialized) {
                await this.init(left, right, top, bottom, width);
                this.currentParameters = left + '_' + right + '_' + top + '_' + bottom + '_' + width;
            }

            this.startTime = Date.now();
            this.currentCameraResolver = resolve;
            this.readyCallback = readyCallback;
            this.cameraProcess.kill('SIGUSR1');
        });
    };
}
