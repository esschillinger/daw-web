import Mixer from "/src/mixer.js"


const mixer = new Mixer({
    container: ".test-container",
    phantomAudioPath: "./audio/20Hz-tone.webm"
});

document.getElementById("export").addEventListener("click", () => {
    const data = mixer.export_tracks();

    console.log(data);
})

document.getElementById("delete").addEventListener("click", () => {
    const audio_id = prompt("Enter ID of track to be deleted:");
    const data = mixer.delete_track(audio_id);

    console.log(data);
});

document.getElementById("reset").addEventListener("click", () => {
    mixer.reset();
});

let audio_ids = [];


// bare necessity to create a track
audio_ids.push(
    mixer.add_track({
        file: "./audio/test_audio.ogg", // audio file path
    })
);

audio_ids.push(
    // audio positioned 1s into the mix, is muted to start
    mixer.add_track({
        file: "./audio/test_audio.ogg",
        color: "hsl(266, 100%, 64%)",
        position: 1000,
        muted: true
    })
);

audio_ids.push(
    // first 2s of audio is cropped, plays 7s into the mix at half volume
    mixer.add_track({
        file: "./audio/test_audio.ogg",
        title: "Overridden title!",
        color: "rgb(208, 37, 37)",
        position: 7000,
        start: 2000,
        volume: 0.5
    })
);

audio_ids.push(
    // set left-cropped audio to play at the beginning of the track
    mixer.add_track({
        file: "./audio/test_audio.ogg",
        color: "#32a952",
        position: 0,
        start: 2500,
        end: 3500
    })
);

audio_ids.push(
    // 1.5s of audio beginning 2.5s into the mix
    mixer.add_track({
        file: "./audio/test_audio.ogg",
        color: "#fd8c73",
        position: 2500,
        start: 2500,
        end: 4000
    })
);

console.log(audio_ids);