# daw-web

Basic web-based DAW built around Wavesurfer. This is a modular version that I intend to continue updating and improving upon; for now, only core features have been implemented.[^1]

I am also aware that Wavesurfer has their own super-plugin for this exact purpose, which I discovered after almost finishing the base component. To the best of my knowledge, their multi-track mixer doesn't have the ability to crop audio, so my effort was (hopefully) not wasted!

See `src/script.js` for usage.

[^1]: **12/26/2024**: I got the basic structure and most essential features in place because I just need it *mostly* functioning for a demo I'm putting together of another project. Once I get the demo in order, I'll probably revisit this side-project soon after to add more features. And yes, I know it can benefit from some better styling too.

## Features

### Arranging

Simply click and drag the audio file to move it around in the demo! Eventually, I'll add support for arrow key movement as well.

### Crop[^2]

Selecting "crop" enables the audio file to be trimmed from the left, right, or both side(s). Crop selections are finalized by clicking the "Apply changes" button. Note that the audio file remains untouched, which allows for audio restoration and re-cropping.

This one definitely took me the longest to get working out of the features currently available, but I think I came up with a pretty neat solution using a couple `clip-path`'s, which also made the JS a lot more manageable!

### Mute/unmute[^2]

Mute or unmute audio files to control whether they are included in audio playback.

### Restore[^2]

Removes any crops applied to an audio file.

### Track zoom

Click the zoom icons in the top right of the mixer or hover over the tracks and press/hold `CTRL + mousewheel[up | down]` to zoom in or out of the tracks. Allows for more fine control over cropping and track placement.

### Volume[^2]

Adjust the slider in the context menu to set the playback volume for a given audio file.

I intend to eventually extend the Wavesurfer functionality which allows for varying volume levels within an audio file.


[^2]: This feature is accessible from the context menu, which is displayed by right-clicking on an audio file.
