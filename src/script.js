import Mixer from "/src/mixer.js"


const mixer = new Mixer({
    container: ".test-container"
});


// bare necessity to create a track
mixer.add_track({
    file: "./audio/test_audio.ogg",
});

// audio positioned 1s into the mix, is muted to start
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(266, 100%, 64%)",
    delay: 1000,
    muted: true
});

// first 2s of audio is cropped, plays 7s + 2s into the mix at half volume
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "rgb(208, 37, 37)",
    delay: 7000,
    start: 2000,
    volume: 0.5
});

// negative delay to match left crop to track start
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "#32a952",
    delay: -2500,
    start: 2500,
    end: 3500
});

// 1.5s of audio beginning 2.5s into the mix
mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "#fd8c73",
    delay: 2500,
    end: 4000
});