import Controller from 'jigsawlutioner-controller';
import camera from './libcamera.js';

const controller = new Controller(3000);

controller.createEndpoint('take-photo', async (parameters, resolve) => {
    const pin = await controller.getOutputPin(parameters, 'light');
    if (['top', 'bottom'].indexOf(parameters.light.position) === -1) {
        throw new Error('Parameter "light[position]" was not one of "top", "bottom".');
    }
    pin.writeSync(parameters.light.position === 'top' ? 0 : 1);

    const photo = await camera.takeImage(parameters.left || null, parameters.right || null, parameters.top || null, parameters.bottom || null, parameters.width || null);

    resolve(photo, 'image/jpeg');
});
