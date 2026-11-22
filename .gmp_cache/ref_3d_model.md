# Add a 3D model to a photorealistic 3D map

3D models (glTF/GLB assets) can be rendered directly within a Photorealistic 3D
Map scene to represent custom objects, vehicles, buildings, or markers. These
models can be positioned, scaled, rotated, and configured for user interaction.

## Prerequisites

-   **Interactive 3D Map**: You must have a web page configured with the Maps
    JavaScript API and an initialized `Map3DElement` (`<gmp-map-3d>`).
-   **glTF Model Requirements**: Models must support the
    [core properties of the glTF PBR](https://www.khronos.org/gltf/pbr)
    specification (`.gltf` or `.glb`). No glTF extensions or extension
    properties are supported.
-   **CORS Configuration**: If you host your 3D model files on a different
    origin or server than your main web application, your server must return
    valid [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) HTTP
    headers (`Access-Control-Allow-Origin`).

--------------------------------------------------------------------------------

## Model Configuration Options

The
[`Model3DElement`](https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw#Model3DElement)
and
[`Model3DInteractiveElement`](https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw#Model3DInteractiveElement)
constructors accept `Model3DElementOptions`:

Option         | Type                                      | Required | Description
:------------- | :---------------------------------------- | :------- | :----------
`position`     | `LatLngLiteral` / `LatLngAltitudeLiteral` | **Yes**  | The geographical coordinates (`lat`, `lng`, and optional `altitude`) of the model.
`src`          | `string` \| `URL`                         | **Yes**  | The URL pointing to the `.glb` or `.gltf` model file.
`altitudeMode` | `AltitudeMode`                            | No       | Specifies how the `altitude` component in `position` is interpreted (e.g., `'CLAMP_TO_GROUND'`, `'RELATIVE_TO_GROUND'`, `'ABSOLUTE'`, `'RELATIVE_TO_MESH'`).
`orientation`  | `Orientation3DLiteral`                    | No       | The rotation of the model (`{ heading, tilt, roll }`). Rotations are applied in the order: **roll**, **tilt**, and then **heading**.
`scale`        | `number` \| `Vector3DLiteral`             | No       | Scales the model in its coordinate space. Default is `1`.

> **Important:** Both `position` and `src` must be specified for a model to
> render in the scene.

--------------------------------------------------------------------------------

## Implementation Patterns

### 1. Add a Static 3D Model (Vanilla JS)

Import `Map3DElement` and `Model3DElement` from the `maps3d` library,
instantiate the model with your options, and append it as a child of the 3D map
element.

```javascript
async function init() {
  // Import the needed libraries.
  const { Map3DElement, Model3DElement } =
    await google.maps.importLibrary('maps3d');

  const map = new Map3DElement({
    center: { lat: 39.1178, lng: -106.4452, altitude: 4395.4952 },
    range: 1500,
    tilt: 74,
    heading: 0,
    mode: 'HYBRID',
  });
  map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

  const model = new Model3DElement({
    src: 'https://maps-docs-team.web.app/assets/windmill.glb',
    position: { lat: 39.1178, lng: -106.4452, altitude: 4495.4952 },
    orientation: { heading: 0, tilt: 270, roll: 90 },
    scale: 0.15,
    altitudeMode: 'CLAMP_TO_GROUND',
  });

  document.body.append(map);
  map.append(model);
}

void init();
```

### 2. Add an Interactive 3D Model (Vanilla JS)

To respond to user clicks on a 3D model, use `Model3DInteractiveElement` and
attach a `'gmp-click'` event listener.

```javascript
async function init() {
  // Import the needed libraries.
  const { Map3DElement, Model3DInteractiveElement } =
    await google.maps.importLibrary('maps3d');

  const map = new Map3DElement({
    center: { lat: 39.1178, lng: -106.4452, altitude: 4395.4952 },
    range: 1500,
    tilt: 74,
    heading: 0,
    mode: 'HYBRID',
  });
  map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

  const model = new Model3DInteractiveElement({
    src: 'https://maps-docs-team.web.app/assets/windmill.glb',
    position: { lat: 39.1178, lng: -106.4452, altitude: 4495.4952 },
    orientation: { heading: 0, tilt: 270, roll: 90 },
    scale: 0.15,
    altitudeMode: 'CLAMP_TO_GROUND',
  });

  // Listen for click interactions on the 3D model
  model.addEventListener('gmp-click', function () {
    this.scale = Math.random() * (0.5 - 0.1) + 0.1;
  });

  document.body.append(map);
  map.append(model);
}

void init();
```

--------------------------------------------------------------------------------

## React Integration & Animation (`@vis.gl/react-google-maps`)

When building with React and `@vis.gl/react-google-maps`, you can wrap the
underlying `<gmp-model-3d>` web component and drive animations (such as
continuous rotation) using `requestAnimationFrame`.

### Wrapper Component (`model-3d.tsx`)

Source:
[visgl/react-google-maps - examples/map-3d-markers/src/model-3d.tsx](https://github.com/visgl/react-google-maps/blob/HEAD/examples/map-3d-markers/src/model-3d.tsx?utm_campaign=gmp_git_agentskills_v1)

```tsx
import type {AltitudeMode as MarkerAltitudeMode} from '@vis.gl/react-google-maps';
import type {PropsWithChildren, Ref} from 'react';
import React, {forwardRef} from 'react';

export type Model3DProps = PropsWithChildren<
  Omit<google.maps.maps3d.Model3DElementOptions, 'altitudeMode'> & {
    altitudeMode?: google.maps.maps3d.AltitudeMode | MarkerAltitudeMode | null;
  }
>;

export const Model3D = forwardRef(function Model3D(
  props: Model3DProps,
  ref: Ref<google.maps.maps3d.Model3DElement>
) {
  const {position, altitudeMode, src, orientation, scale} = props;

  return (
    <gmp-model-3d
      ref={ref}
      position={position}
      altitude-mode={altitudeMode}
      src={src}
      orientation={orientation}
      scale={scale}
    />
  );
});

Model3D.displayName = 'Model3D';
```

### Animated Model Usage (`app.tsx`)

Source:
[visgl/react-google-maps - examples/map-3d-markers/src/app.tsx](https://github.com/visgl/react-google-maps/blob/HEAD/examples/map-3d-markers/src/app.tsx?utm_campaign=gmp_git_agentskills_v1)

```tsx
import React, {useEffect, useState} from 'react';
import {AltitudeMode, APIProvider} from '@vis.gl/react-google-maps';
import {Map3D, MapMode} from '@vis.gl/react-google-maps/3d';
import {Model3D, Model3DProps} from './model-3d';

const AnimatedModel3D = (modelProps: Model3DProps) => {
  const rotationSpeed = 10;
  const [modelHeading, setModelHeading] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      if (lastTimestamp === 0) lastTimestamp = timestamp;

      const deltaTime = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      setModelHeading(prev => (prev + rotationSpeed * deltaTime) % 360);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [rotationSpeed]);

  return (
    <Model3D
      {...modelProps}
      orientation={{heading: modelHeading, tilt: 0, roll: 0}}
    />
  );
};

export const App = () => (
  <APIProvider apiKey={process.env.GOOGLE_MAPS_API_KEY as string} libraries={['maps3d']}>
    <Map3D
      mode={MapMode.SATELLITE}
      defaultCenter={{lat: 40.7093, lng: -73.9968, altitude: 32}}
      defaultRange={1733}
      defaultHeading={5}
      defaultTilt={70}
      internalUsageAttributionIds={['gmp_git_agentskills_v1']}>
      <AnimatedModel3D
        position={{lat: 40.708804, lng: -74.000229, altitude: 150}}
        altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
        src="https://maps-docs-team.web.app/assets/windmill.glb"
        scale={10}
      />
    </Map3D>
  </APIProvider>
);
```

--------------------------------------------------------------------------------

## Troubleshooting & Best Practices

-   **Model Not Rendering**:
    1.  Verify both `position` and `src` are provided.
    2.  Check the browser network console for CORS errors if loading the
        `.glb`/`.gltf` file from an external domain.
    3.  Confirm the `altitude` and `altitudeMode` place the model within the
        camera's visible frustum (use `'CLAMP_TO_GROUND'` or
        `'RELATIVE_TO_GROUND'` to avoid accidentally placing models underground
        or high in space when terrain elevation is high).
    4.  Ensure your glTF file only uses core PBR properties and does not rely on
        unsupported glTF extensions (e.g., Draco compression or custom shader
        extensions).
-   **Orientation Order**: Remember that `orientation` applies rotations in the
    order **roll -> tilt -> heading**. If a model appears sideways, adjust
    `tilt` and `roll` first before setting `heading`.
