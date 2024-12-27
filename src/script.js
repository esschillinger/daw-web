import Mixer from "/src/mixer.js"



const mixer = new Mixer({
    container: ".test-container"
});

mixer.add_track({
    file: "./audio/test_audio.ogg",
});

// audio begins playing 1s into the mix
mixer.add_track({
    file: "./audio/test_audio.ogg",
    delay: 1000,
    color: "hsl(266, 100%, 64%)"
});

// first 2s of audio is cropped
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(0, 70%, 48%)",
    start: 2000,
    volume: 0.5
});

// 1 second of the audio, beginning 2.5s into the original audio
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(136, 54%, 43%)",
    delay: 5000,
    start: 2500,
    end: 3500
});

// muted track with other settings
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "#fd8c73",
    delay: 2500,
    end: 4000,
    muted: true
});