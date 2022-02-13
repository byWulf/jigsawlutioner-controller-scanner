import Controller from 'jigsawlutioner-controller';
import camera from './libcamera.js';

const controller = new Controller(3000);

controller.createEndpoint('take-photo', async (parameters, resolve) => {
    const photo = await camera.takeImage(parameters.left || null, parameters.right || null, parameters.top || null, parameters.bottom || null, parameters.width || null);

    resolve(photo, 'image/jpeg');
});
