import Controller from 'jigsawlutioner-controller';
import camera from './libcamera.js';

const controller = new Controller(3000);

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// Old endpoint for taking a photo synchronously
controller.createEndpoint('take-photo', async (parameters, resolve) => {
    const pin = await controller.getOutputPin(parameters, 'light');
    if (['top', 'bottom'].indexOf(parameters.light.position) === -1) {
        throw new Error('Parameter "light[position]" was not one of "top", "bottom".');
    }
    pin.writeSync(parameters.light.position === 'top' ? 0 : 1);

    const photo = await camera.takeImage(parameters.left || null, parameters.right || null, parameters.top || null, parameters.bottom || null, parameters.width || null);

    if (parameters.light.positionAfter !== undefined) {
        if (['top', 'bottom'].indexOf(parameters.light.positionAfter) === -1) {
            throw new Error('Parameter "light[positionAfter]" was not one of "top", "bottom".');
        }
        pin.writeSync(parameters.light.positionAfter === 'top' ? 0 : 1);
    }

    resolve(photo, 'image/jpeg');
});

// New endpoints for faster
let nextPhotoIndex = 0;
const photos = {};
let takingPhoto = false;
controller.createEndpoint('request-photo', async (parameters, resolve) => {
    const pin = await controller.getOutputPin(parameters, 'light');
    if (['top', 'bottom'].indexOf(parameters.light.position) === -1) {
        throw new Error('Parameter "light[position]" was not one of "top", "bottom".');
    }
    pin.writeSync(parameters.light.position === 'top' ? 0 : 1);

    while (takingPhoto) {
        await sleep(10);
    }

    const photoIndex = nextPhotoIndex;
    nextPhotoIndex++;

    takingPhoto = true;

    photos[photoIndex] = await camera.takeImage(
      parameters.left || null,
      parameters.right || null,
      parameters.top || null,
      parameters.bottom || null,
      parameters.width || null,
      () => resolve(photoIndex.toString())
    );

    takingPhoto = false;
});

controller.createEndpoint('fetch-photo', async (parameters, resolve) => {
    if (parameters.photo === undefined) {
        throw new Error('Parameter "photo" was missing.');
    }

    if (photos[parameters.photo] === null) {
        throw new Error('Photo has already been fetched. Please request a new image.');
    }

    while (photos[parameters.photo] === undefined) {
        await sleep(10);
    }

    resolve(photos[parameters.photo], 'image/jpeg');

    photos[parameters.photo] = null;
});
