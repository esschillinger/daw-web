import Mixer from "/src/mixer.js"



const mixer = new Mixer({
    container: ".test-container"
});

mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(207, 90%, 54%)"
});

mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(266, 100%, 64%)"
});

mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(0, 70%, 48%)"
});

mixer.add_track({
    file: "./audio/test_audio.ogg",
    color: "hsl(136, 54%, 43%)"
});