import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js'


export default class Mixer {
    #attributes = {
        container: "body",
        duration: 20, // seconds
        timelineWidth: 50, // pixels
        timelineSpaceDuration: 1, // seconds
        zoomIncrement : 10,
        timelineGridMin : 50,
        timelineGridMax : 100
    };

    // audio waveform: [-->>---|--->>->->>>---|----]
    //                ref    start           end
    #default_audio_options = {
        position: 0, // displacement between "start" and the beginning of the track, ms
        delay: 0, // displacement between "start" and the slider position on 'play', ms; effectively only useful internally
        start: 0, // left audio crop point relative to the start of the audio file, ms (see poor waveform sketch above)
        end: -1, // right crop point relative to the start of the audio file, ms (see poor waveform sketch above). NOTE: the only negative value allowed is -1
        volume: 1, // audio volume on the interval [0, 1]
        muted: false, // pretty self-explanatory
        color: "hsl(207, 90%, 54%)" // default audio color base, str; can use any color function, not just hsl()
    }

    // element references
    #mixer;
    #scroll_container;
    #slider;
    #timeline;
    #track_list;
    #play_button;
    #audio_controls;
    #mute_button;
    #unmute_button;
    #crop_button;
    #restore_button;
    #volume;
    #mixer_toolbar;
    #apply_change_button;
    #discard_change_button;
    #zoom_in_button;
    #zoom_out_button;
    #phantom_audio;
    #time_controls;

    // data management
    #audio_map = new Map(); // audio_id : { wavesurfer, delay, start, end, volume, muted, delay (temp) }
    #audio_counter = 0;
    #loading_wavesurfers = 0; // semaphore

    // playback management
    #demo_playing = false;

    // crop clip path and control management
    #crop_bar_width = 30;

    // temporary variables to scope audio changes locally
    #dragging_audio;
    #cropping_audio;
    #initial_audio_left;
    #initial_crop_bar_left;


    constructor(attributes) {
        this.#attributes = {...this.#attributes, ...attributes}; // override default properties with params
        
        let container = document.querySelector(this.#attributes.container);

        this.#mixer = document.createElement("div");
        this.#mixer.classList.add("mixer");
        this.#mixer.style.setProperty("--_duration", this.#attributes.duration);
        this.#mixer.style.setProperty("--_timeline-width", `${this.#attributes.timelineWidth}px`);
        this.#mixer.style.setProperty("--_timeline-space-duration", this.#attributes.timelineSpaceDuration);
        this.#mixer.dataset.state = "ready";


        container.appendChild(this.#mixer);


        this.#audio_controls = document.createElement("div");
        this.#audio_controls.id = "audio-controls";
        this.#audio_controls.dataset.state = "hidden";

        let control = document.createElement("div");
        control.classList.add("control");

        this.#mute_button = document.createElement("button");
        // this.#mute_button.id = "mute";
        this.#mute_button.textContent = "Mute";

        control.appendChild(this.#mute_button);
        this.#audio_controls.appendChild(control);

        control = document.createElement("div");
        control.classList.add("control");

        this.#unmute_button = document.createElement("button");
        // this.#unmute_button.id = "unmute";
        this.#unmute_button.disabled = true;
        this.#unmute_button.textContent = "Unmute";

        control.appendChild(this.#unmute_button);
        this.#audio_controls.appendChild(control);

        control = document.createElement("div");
        control.classList.add("control");

        this.#crop_button = document.createElement("button");
        // this.#crop_button.id = "crop";
        this.#crop_button.textContent = "Crop";

        control.appendChild(this.#crop_button);
        this.#audio_controls.appendChild(control);
        
        control = document.createElement("div");
        control.classList.add("control");

        this.#restore_button = document.createElement("button");
        // this.#restore_button.id = "restore";
        this.#restore_button.textContent = "Restore";

        control.appendChild(this.#restore_button);
        this.#audio_controls.appendChild(control);

        control = document.createElement("div");
        control.classList.add("control");

        this.#volume = document.createElement("input");
        this.#volume.type = "range";
        // this.#volume.id = "volume";
        this.#volume.min = 0.01;
        this.#volume.max = 1;
        this.#volume.step = 0.01;
        this.#volume.value = 1;

        control.appendChild(this.#volume);
        this.#audio_controls.appendChild(control);


        this.#mixer.appendChild(this.#audio_controls);


        this.#phantom_audio = document.createElement("audio");
        this.#phantom_audio.src = this.#attributes.phantomAudioPath; // 20Hz tone to keep audio drivers awake during playback, fix sync issues
        this.#phantom_audio.id = "phantom-audio";
        this.#phantom_audio.loop = true;
        this.#phantom_audio.volume = 0.01;


        this.#mixer.appendChild(this.#phantom_audio);


        this.#mixer_toolbar = document.createElement("div");
        this.#mixer_toolbar.classList.add("mixer__toolbar");

        this.#discard_change_button = document.createElement("button");
        this.#discard_change_button.classList.add("icon-wrapper");
        
        let icon = document.createElement("i");
        icon.classList.add("icon");
        icon.classList.add("icon__xmark");

        let label = document.createElement("span");
        label.textContent = "Discard changes";

        this.#discard_change_button.appendChild(icon);
        this.#discard_change_button.appendChild(label);

        this.#apply_change_button = document.createElement("button");
        this.#apply_change_button.classList.add("icon-wrapper");
        
        icon = document.createElement("i");
        icon.classList.add("icon");
        icon.classList.add("icon__check");

        label = document.createElement("span");
        label.textContent = "Apply changes";

        this.#apply_change_button.appendChild(icon);
        this.#apply_change_button.appendChild(label);

        let zoom_group = document.createElement("div");
        zoom_group.classList.add("action-group");

        this.#zoom_out_button = document.createElement("button");
        this.#zoom_out_button.classList.add("icon-wrapper");

        icon = document.createElement("i");
        icon.classList.add("icon");
        icon.classList.add("icon__zoom-out");

        this.#zoom_out_button.appendChild(icon);

        this.#zoom_in_button = document.createElement("button");
        this.#zoom_in_button.classList.add("icon-wrapper");

        icon = document.createElement("i");
        icon.classList.add("icon");
        icon.classList.add("icon__zoom-in");

        this.#zoom_in_button.appendChild(icon);
        
        zoom_group.appendChild(this.#zoom_out_button);
        zoom_group.appendChild(this.#zoom_in_button);


        this.#mixer_toolbar.appendChild(this.#discard_change_button);
        this.#mixer_toolbar.appendChild(this.#apply_change_button);
        this.#mixer_toolbar.appendChild(zoom_group);


        this.#mixer.appendChild(this.#mixer_toolbar);


        let main_wrapper = document.createElement("div");
        main_wrapper.classList.add("mixer__main-wrapper");

        this.#scroll_container = document.createElement("div");
        this.#scroll_container.classList.add("scroll-wrapper");
        this.#scroll_container.classContext = this;

        this.#slider = document.createElement("div");
        this.#slider.classList.add("slider");

        this.#scroll_container.appendChild(this.#slider);

        let timeline_wrapper = document.createElement("div");
        timeline_wrapper.classList.add("timeline-wrapper");

        this.#timeline = document.createElement("div");
        this.#timeline.classList.add("timeline");

        for (let x = 0; x < this.#attributes.duration; x++) {
            let grid_space = document.createElement("div");
            grid_space.classList.add("grid-space");
    
            if (x % 5 == 4) {
                // match with :nth-child(xn) selector in CSS (.grid-spaces with double height and lighter border)
                grid_space.dataset.value = `${x + 1}s`;
            }
    
            this.#timeline.appendChild(grid_space);
        }

        timeline_wrapper.appendChild(this.#timeline);

        this.#scroll_container.appendChild(timeline_wrapper);

        main_wrapper.appendChild(this.#scroll_container);


        this.#mixer.appendChild(main_wrapper);


        this.#track_list = document.createElement("div");
        this.#track_list.classList.add("track-list");
        this.#track_list.classContext = this;

        this.#scroll_container.appendChild(this.#track_list);

        let controls = document.createElement("div");
        controls.classList.add("controls");

        this.#play_button = document.createElement("button");
        this.#play_button.classList.add("icon-wrapper");

        icon = document.createElement("i");
        icon.classList.add("icon")
        icon.classList.add("icon__play");

        this.#play_button.appendChild(icon);

        controls.appendChild(this.#play_button);

        this.#time_controls = document.createElement("input");
        this.#time_controls.type = "range";
        this.#time_controls.classList.add("time-controls");
        this.#time_controls.min = 0;
        this.#time_controls.max = 100;
        this.#time_controls.value = 0;

        controls.appendChild(this.#time_controls);


        this.#mixer.appendChild(controls);

        this.#bind_event_listeners();
    }

    add_track(options) {
        const audio_settings = {...this.#default_audio_options, ...options};

        this.#loading_wavesurfers++;
        this.#mixer.dataset.state = "loading";

        const track = document.createElement("div");
        track.classList.add("track");

        const audio_wrapper = document.createElement("div");
        audio_wrapper.classList.add("audio-wrapper");
        audio_wrapper.style.setProperty("--_color", audio_settings.color);
        audio_wrapper.dataset.id = this.#audio_counter++;
        audio_wrapper.dataset.file = audio_settings.title ? audio_settings.title : audio_settings.file; // perhaps audio_settings.file.split("/")[-1] to isolate file name
        audio_wrapper.classContext = this;

        const crop_tool = document.createElement("div");
        const crop_top = document.createElement("div");
        const crop_left = document.createElement("button");
        const crop_bottom = document.createElement("div");
        const crop_right = document.createElement("button");
        const left_chevron = document.createElement("i");
        const right_chevron = document.createElement("i");

        crop_tool.classList.add("crop-tool");
        crop_tool.dataset.state = "inactive";

        crop_top.classList.add("crop__top-border");

        crop_left.classList.add("crop__left-handle");
        crop_left.classList.add("icon-wrapper");
        left_chevron.classList.add("icon");
        left_chevron.classList.add("icon__left-chevron");
        crop_left.appendChild(left_chevron);

        crop_bottom.classList.add("crop__bottom-border");

        crop_right.classList.add("crop__right-handle");
        crop_right.classList.add("icon-wrapper");
        right_chevron.classList.add("icon");
        right_chevron.classList.add("icon__right-chevron");
        crop_right.appendChild(right_chevron)

        crop_tool.appendChild(crop_left);
        crop_tool.appendChild(crop_right);
        crop_tool.appendChild(crop_top);
        crop_tool.appendChild(crop_bottom);

        audio_wrapper.appendChild(crop_tool);
        track.appendChild(audio_wrapper);
        this.#track_list.appendChild(track);

        const height = track.getBoundingClientRect().height;

        let wavesurfer = WaveSurfer.create({
            container : audio_wrapper,
            height : height,
            waveColor : `hsl(from ${audio_settings.color} h s calc(l * 1.25))`,
            progressColor : audio_settings.color, // var(--_color)
            cursorWidth : 0,
            url : audio_settings.file,
            backend: 'MediaElement'
        });

        let wavesurfer_map = new Map();
        wavesurfer_map.set("filepath", audio_settings.file);
        wavesurfer_map.set("wavesurfer", wavesurfer);
        wavesurfer_map.set("position", audio_settings.position);
        wavesurfer_map.set("delay", audio_settings.delay);
        wavesurfer_map.set("start", audio_settings.start);
        wavesurfer_map.set("end", audio_settings.end);
        wavesurfer_map.set("volume", audio_settings.volume);
        wavesurfer_map.set("muted", audio_settings.muted);
        wavesurfer_map.set("color", audio_settings.color);

        wavesurfer.setVolume(audio_settings.volume);

        this.#audio_map.set(audio_wrapper.dataset.id, wavesurfer_map);

        wavesurfer.on("ready", () => {
            const track_width = this.#track_list.getBoundingClientRect().width;
            const ratio = wavesurfer.getDuration() / this.#attributes.duration;
            const audio_width = ratio * track_width;

            audio_wrapper.style.setProperty("--_audio-width", `${audio_width}px`);
            audio_wrapper.style.left = `${track_width * ((audio_settings.position - audio_settings.start) / 1000) / this.#attributes.duration}px`;

            let cropped = false;

            if (audio_settings.start != 0) cropped = true;

            const left = wavesurfer_map.get("start") / 1000 / wavesurfer.getDuration() * audio_width;
            let right;

            if (audio_settings.end != -1) {
                cropped = true;
                right = audio_settings.end / 1000 / wavesurfer.getDuration() * audio_width;
            } else {
                right = audio_width;
            }

            audio_wrapper.style.setProperty("--_left", `${left}px`);
            audio_wrapper.style.setProperty("--_right", `${right}px`);

            if (cropped) audio_wrapper.classList.add("cropped");

            audio_wrapper.dataset.muted = audio_settings.muted;

            this.#loading_wavesurfers--;
            if (this.#loading_wavesurfers == 0) this.#mixer.dataset.state = "ready";
        });

        wavesurfer.on("click", () => {
            // prevent default seek behavior
            wavesurfer.setTime(0);
        });

        wavesurfer.on("dblclick", () => {
            wavesurfer.play();
        });

        this.#slider.style.height = `${this.#track_list.getBoundingClientRect().height + this.#timeline.getBoundingClientRect().height}px`;

        return audio_wrapper.dataset.id; // return the locally-scoped ID assigned to the audio
    }

    delete_track(audio_id) {
        const data = this.#audio_map.get(audio_id);
        const track = this.#track_list.querySelector(`.track:has(.audio-wrapper[data-id="${audio_id}"])`);

        this.#audio_map.delete(audio_id);
        this.#track_list.removeChild(track);

        this.#slider.style.height = `${this.#track_list.getBoundingClientRect().height + this.#timeline.getBoundingClientRect().height}px`;

        return data;
    }

    reset() {
        this.#demo_playing = false;
        this.#time_controls.value = 0;
        this.#audio_counter = 0;
        this.#play_button.firstChild.classList.remove("icon__pause");

        for (const [k, v] of this.#audio_map) {
            this.delete_track(k);
        }
    }

    export_tracks() {
        return this.#audio_map;
    }

    #get_custom_property(property, styles) {
        const prop = styles.split(";").find(style => style.includes(property));
        const value = prop.slice(prop.indexOf(":") + 1);
    
        return value;
    }

    #move_audio(e) {
        const _this = this.classContext;
        const container_rect = _this.#scroll_container.getBoundingClientRect();
        const left_margin = container_rect.left;
        const audio_rect = _this.#dragging_audio.getBoundingClientRect();
        const cursor_left = _this.#scroll_container.scrollLeft + e.clientX - left_margin; // cursor left, relative to scroll container
        const track_width = _this.#track_list.getBoundingClientRect().width;
        const crop_left = parseInt(_this.#get_custom_property("--_left", _this.#dragging_audio.style.cssText));
        const crop_right = parseInt(_this.#get_custom_property("--_right", _this.#dragging_audio.style.cssText));
    
        let min_left = 0;
        let max_left = track_width - audio_rect.width;

        if (_this.#dragging_audio.querySelector(".crop-tool").dataset.state == "inactive") {
            if (crop_left > 0) min_left = -1 * crop_left;
            if (crop_right < audio_rect.width) max_left = track_width - crop_right;
        }
        
        if (!_this.#dragging_audio.style.left) {
            _this.#dragging_audio.style.left = `${audio_rect.left}px`;
        }
    
        let new_audio_left = cursor_left - _this.#initial_audio_left;
    
        if (new_audio_left < min_left) new_audio_left = min_left;
        else if (new_audio_left > max_left) new_audio_left = max_left;
    
        _this.#dragging_audio.style.left = `${new_audio_left}px`;
    }

    #keep_audio_within_bounds(audio_id) {
        const audio_wrapper = this.#track_list.querySelector(`.audio-wrapper[data-id="${audio_id}"]`);
        const audio_left = audio_wrapper.style.left === "" ? 0 : parseInt(audio_wrapper.style.left);
        const audio_width = audio_wrapper.getBoundingClientRect().width;
        const track_width = this.#track_list.getBoundingClientRect().width;
    
        if (audio_left < 0) audio_wrapper.style.left = "0px";
        else if (audio_left + audio_width > track_width) audio_wrapper.style.left = `${track_width - audio_width}px`;
    }

    #prevent_audio_move() {
        const _this = this.classContext;
        if (_this.#dragging_audio) {
            const audio_id = _this.#dragging_audio.dataset.id;

            let position = parseInt(_this.#dragging_audio.style.left) / _this.#track_list.getBoundingClientRect().width * _this.#attributes.duration * 1000;
            position += _this.#audio_map.get(audio_id).get("start");

            _this.#audio_map.get(audio_id).set("position", position);

            _this.#dragging_audio = null;
            _this.#initial_audio_left = null;
            
            _this.#track_list.removeEventListener("mousemove", _this.#move_audio);
        }
    }

    #crop_audio_from_left(e) {
        const _this = this.classContext;
        const audio_rect = _this.#cropping_audio.getBoundingClientRect();
        const cursor_pos = e.clientX - audio_rect.left;
        const crop_tool = _this.#cropping_audio.querySelector(".crop-tool");
        const max_left = parseInt(_this.#get_custom_property("--_right", _this.#cropping_audio.style.cssText));
    
        let new_left = cursor_pos - _this.#initial_crop_bar_left;
    
        if (new_left > max_left) new_left = max_left;
        else if (new_left < 0) new_left = 0;
    
        let crop_left_overflow = 0;
    
        if (new_left < _this.#crop_bar_width) crop_left_overflow = new_left;
        else crop_left_overflow = _this.#crop_bar_width;
    
        _this.#cropping_audio.style.setProperty("--_left", `${new_left}px`);
        crop_tool.style.setProperty("--_crop-left-overflow", `${crop_left_overflow}px`);
    }
    
    
    #crop_audio_from_right(e) {
        const _this = this.classContext;
        const audio_rect = _this.#cropping_audio.getBoundingClientRect();
        const cursor_pos = e.clientX - audio_rect.left;
        const crop_tool = _this.#cropping_audio.querySelector(".crop-tool");
        const min_left = parseInt(_this.#get_custom_property("--_left", _this.#cropping_audio.style.cssText));
    
        let new_right = cursor_pos - _this.#initial_crop_bar_left;
    
        if (new_right < min_left) new_right = min_left;
        else if (new_right > audio_rect.width) new_right = audio_rect.width;
    
        let crop_right_overflow = 0;
    
        if (new_right > (audio_rect.width - _this.#crop_bar_width)) crop_right_overflow = audio_rect.width - new_right;
        else crop_right_overflow = _this.#crop_bar_width;
    
        _this.#cropping_audio.style.setProperty("--_right", `${new_right}px`);
        crop_tool.style.setProperty("--_crop-right-overflow", `${crop_right_overflow}px`);
    }

    #revert_crop(audio_id) {
        const audio_wrapper = this.#track_list.querySelector(`.audio-wrapper[data-id="${audio_id}"]`);
        const audio_width = audio_wrapper.getBoundingClientRect().width;
        const audio_data = this.#audio_map.get(audio_id);
        const duration = audio_data.get("wavesurfer").getDuration() * 1000;
        const start = audio_data.get("start");
        let end = audio_data.get("end");
    
        if (end == -1) end = duration;
    
        const left = start / duration * audio_width;
        const right = end / duration * audio_width;
    
        audio_wrapper.style.setProperty("--_left", `${left}px`);
        audio_wrapper.style.setProperty("--_right", `${right}px`);
    
        const crop_tool = audio_wrapper.querySelector(".crop-tool");
        let left_overflow = this.#crop_bar_width;
        let right_overflow = this.#crop_bar_width;
    
        
        if (left < this.#crop_bar_width) left_overflow = left;
        if (right > (audio_width - this.#crop_bar_width)) right_overflow = audio_width - right;
        
        crop_tool.style.setProperty("--_crop-left-overflow", `${left_overflow}px`);
        crop_tool.style.setProperty("--_crop-right-overflow", `${right_overflow}px`);
    
        this.#keep_audio_within_bounds(audio_id);
    }

    #prevent_audio_crop() {
        const _this = this.classContext;
        if (_this.#cropping_audio) {
            _this.#initial_crop_bar_left = null;
            _this.#cropping_audio.removeEventListener("mousemove", _this.#crop_audio_from_left);
            _this.#cropping_audio.removeEventListener("mousemove", _this.#crop_audio_from_right);
            
            // this.#cropping_audio = null;
        }
    }

    #track_zoom(zoom_in) {
        let grid_space_count = this.#timeline.querySelectorAll(".grid-space").length;
        let tl_grid_width = parseInt(this.#get_custom_property('--_timeline-width', this.#mixer.style.cssText));
        let multiplier = null;
    
        if (!zoom_in) {
            if (5 <= grid_space_count && grid_space_count < 10 && tl_grid_width == this.#attributes.timelineGridMin) return; // zoom out limit
            else if ((tl_grid_width -= this.#attributes.zoomIncrement) < this.#attributes.timelineGridMin) {
                // halve the number of .grid-spaces
                multiplier = 0.5;
                tl_grid_width = this.#attributes.timelineGridMax;
            }
        } else if ((tl_grid_width += this.#attributes.zoomIncrement) > this.#attributes.timelineGridMax) {
            if ((grid_space_count / this.#attributes.duration) >= 8) return; // zoom in limit (8+ .grid-spaces per second)
            else {
                // double the number of .grid-spaces
                multiplier = 2;
                tl_grid_width = this.#attributes.timelineGridMin;
            }
        }
    
        if (multiplier) {
            grid_space_count *= multiplier;
    
            const timeline_space_duration = (1 / multiplier) * this.#attributes.timelineSpaceDuration;
            let timeline_innerhtml = '';
        
            for (let x = 0; x < grid_space_count; x++) {
                const grid_space = document.createElement("div");
                grid_space.classList.add("grid-space");
        
                if (x % 5 == 4) grid_space.dataset.value = `${(x + 1) * (this.#attributes.duration / grid_space_count)}s`;
                timeline_innerhtml += grid_space.outerHTML;
            }
        
            this.#timeline.innerHTML = timeline_innerhtml;
            this.#attributes.timelineSpaceDuration = timeline_space_duration;
            this.#mixer.style.setProperty('--_timeline-space-duration', `${timeline_space_duration}`);
        }
    
        // need ratio of new track width to old track width to position audio properly with left
        let initial_track_width = this.#track_list.getBoundingClientRect().width;
        
        this.#attributes.timelineWidth = tl_grid_width;
        this.#mixer.style.setProperty('--_timeline-width', `${tl_grid_width}px`);
    
        // if the number of .grid-spaces is being changed, initial_track_width will be 2x what it should be (unchanged) for a split second
        if (multiplier) {
            // so in that case, update it to be the correct value
            initial_track_width = this.#track_list.getBoundingClientRect().width;
        }
    
        const new_track_width = this.#track_list.getBoundingClientRect().width;
    
        this.#mixer.querySelectorAll(".audio-wrapper").forEach((elem) => {
            const audio_ratio = this.#audio_map.get(elem.dataset.id).get("wavesurfer").getDuration() / this.#attributes.duration;
            const initial_audio_width = parseInt(this.#get_custom_property("--_audio-width", elem.style.cssText));
            const new_audio_width = audio_ratio * new_track_width;
            const crop_ratio = new_audio_width / initial_audio_width;
    
            elem.style.setProperty("--_audio-width", `${new_audio_width}px`);
            let offset = elem.style.left === "" ? 0 : parseFloat(elem.style.left);
            
            if (offset != 0) {
                elem.style.left = `${offset * (new_track_width / initial_track_width)}px`;
            }
    
            const initial_crop_left = parseInt(this.#get_custom_property("--_left", elem.style.cssText));
            const initial_crop_right = parseInt(this.#get_custom_property("--_right", elem.style.cssText));
    
            elem.style.setProperty("--_left", `${initial_crop_left * crop_ratio}px`);
            elem.style.setProperty("--_right", `${initial_crop_right * crop_ratio}px`);
        });
    
        const slider_position = this.#slider.style.left === "" ? 0 : parseInt(this.#slider.style.left);
        const new_slider_position = slider_position * new_track_width / initial_track_width;
    
        this.#slider.style.left = `${new_slider_position}px`;
    
        // force slider to stay in the track if zoom out makes its left larger than track width
        // deprecated after adding slider position adjustment, can probably safely remove this
        if (new_slider_position > new_track_width) {
            this.#slider.style.left = `${new_track_width}px`;
        }
    }

    #track_zoom_with_wheel(e) {
        const _this = this.classContext;
        let supports_wheel = false;
        
        if (!e.ctrlKey) return;
        e.preventDefault();
    
        if (e.type == "wheel") supports_wheel = true;
        else if (supports_wheel) return;
    
        let delta = ((e.deltaY || -e.wheelDelta || e.detail) >> 10) || 1;
    
        if (delta > 0) _this.#track_zoom(false); // scroll up, zoom out
        else _this.#track_zoom(true); // scroll down, zoom in
    }

    #mute_audio(muted) {
        this.#mixer.querySelector(`.audio-wrapper[data-id="${this.#audio_controls.dataset.audioid}"]`).dataset.muted = `${muted}`;
        this.#audio_map.get(this.#audio_controls.dataset.audioid).set("muted", muted);
        this.#mute_button.disabled = muted;
        this.#unmute_button.disabled = !muted;
    
        this.#audio_controls.dataset.state = "hidden";
    }

    #bind_event_listeners() {
        this.#scroll_container.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this.#demo_playing = false;
            this.#play_button.firstChild.classList.remove("icon__pause");

            const container_rect = this.#scroll_container.getBoundingClientRect();
            const left_margin = container_rect.left;
            const cursor_left = this.#scroll_container.scrollLeft + e.clientX - left_margin;
    
            if (!e.target.offsetParent || !["audio-wrapper", "crop-tool"].some(s => e.target.offsetParent.classList.contains(s) || e.target.parentNode.offsetParent.classList.contains(s))) {
                const track_width = this.#track_list.getBoundingClientRect().width;
    
                if (cursor_left < track_width) {
                    this.#slider.style.left = `${cursor_left}px`;
                    this.#time_controls.value = Math.floor(cursor_left / track_width * 100);
                }
            }
    
            this.#audio_controls.dataset.state = "hidden";
        });
    
        this.#time_controls.addEventListener("input", () => {
            const track_width = this.#track_list.getBoundingClientRect().width;
    
            this.#slider.style.left = `${this.#time_controls.value * track_width / 100}px`;
        });
    
        this.#track_list.addEventListener("mousedown", (e) => {
            if (e.target.offsetParent && e.target.offsetParent.classList.contains("audio-wrapper")) {
                this.#dragging_audio = e.target.offsetParent;
                this.#initial_audio_left = e.clientX - this.#dragging_audio.getBoundingClientRect().left;

                this.#track_list.addEventListener("mousemove", this.#move_audio);
    
            } else if (e.target.classList.contains("crop__left-handle") || e.target.offsetParent.classList.contains("crop__left-handle")) {
                this.#initial_crop_bar_left = e.clientX - this.#cropping_audio.querySelector(".crop__left-handle").getBoundingClientRect().right;
                
                this.#cropping_audio.addEventListener("mousemove", this.#crop_audio_from_left);
                this.#cropping_audio.addEventListener("mouseup", this.#prevent_audio_crop);
                this.#cropping_audio.addEventListener("mouseleave", this.#prevent_audio_crop);
    
            } else if (e.target.classList.contains("crop__right-handle") || e.target.offsetParent.classList.contains("crop__right-handle")) {
                this.#initial_crop_bar_left = e.clientX - this.#cropping_audio.querySelector(".crop__right-handle").getBoundingClientRect().left;
                
                this.#cropping_audio.addEventListener("mousemove", this.#crop_audio_from_right);
                this.#cropping_audio.addEventListener("mouseup", this.#prevent_audio_crop);
                this.#cropping_audio.addEventListener("mouseleave", this.#prevent_audio_crop);
            }
        });
    
        this.#track_list.addEventListener("mouseup", this.#prevent_audio_move);
        this.#track_list.addEventListener("mouseleave", this.#prevent_audio_move);
    
        this.#apply_change_button.addEventListener("click", () => {
            const audio_id = this.#cropping_audio.dataset.id;
            const audio_width = this.#cropping_audio.getBoundingClientRect().width; // xonar
            const wavesurfer = this.#audio_map.get(audio_id).get("wavesurfer");
            const crop_left = parseInt(this.#get_custom_property("--_left", this.#cropping_audio.style.cssText));
            const crop_right = parseInt(this.#get_custom_property("--_right", this.#cropping_audio.style.cssText));
            let start;
            let end;
    
            // left side is cropped
            if (crop_left > 0) {
                start = Math.floor(crop_left / audio_width * wavesurfer.getDuration() * 1000); // convert to ms
            } else {
                start = 0; // reset if audio used to be cropped
            }
            
            // right side is cropped
            if (crop_right < audio_width) {
                end = Math.ceil(crop_right / audio_width * wavesurfer.getDuration() * 1000); // convert to ms
            } else {
                end = -1; // reset if audio used to be cropped
            }
    
            this.#audio_map.get(audio_id).set("start", start);
            this.#audio_map.get(audio_id).set("end", end);
    
            this.#cropping_audio.classList.add("cropped");
            this.#cropping_audio.querySelector(".crop-tool").dataset.state = "inactive";
        });
    
        this.#discard_change_button.addEventListener("click", () => {
            this.#revert_crop(this.#cropping_audio.dataset.id);
    
            this.#cropping_audio.querySelector(".crop-tool").dataset.state = "inactive";
        });
    
        this.#scroll_container.addEventListener("wheel", this.#track_zoom_with_wheel);
        this.#scroll_container.addEventListener("mousewheel", this.#track_zoom_with_wheel);
        this.#scroll_container.addEventListener("DOMMouseScroll", this.#track_zoom_with_wheel);
    
        this.#zoom_in_button.addEventListener("click", () => this.#track_zoom(true));
        this.#zoom_out_button.addEventListener("click", () => this.#track_zoom(false));
    
        this.#scroll_container.addEventListener("contextmenu", (e) => {
            e.preventDefault(); // prevent standard context menu from appearing
    
            const audio_wrapper = e.target.offsetParent;
            if (audio_wrapper && audio_wrapper.classList.contains("audio-wrapper")) {
                // map current audio to #audio-controls
                const audio_id = audio_wrapper.dataset.id;
                this.#audio_controls.dataset.audioid = audio_id;
    
                // set values to match the focused audio state
                const muted = this.#audio_map.get(audio_id).get("muted");
                this.#mute_button.disabled = muted;
                this.#unmute_button.disabled = !muted;
    
                this.#volume.value = this.#audio_map.get(audio_id).get("volume");
    
                // match volume slider accent color to audio color
                this.#audio_controls.style.setProperty("--_accent-color", this.#audio_map.get(audio_id).get("color"));
    
                // get #audio-controls menu width and height
                // const audio_controls_size = audio_controls.getBoundingClientRect();
                // const width = audio_controls_size.width;
                // const height = audio_controls_size.height;
    
                // TODO try to place #audio-controls to the bottom and right of the cursor, adjust based on size
    
                // for now, just stick it to the bottom and right (it's late, i'm tired)
                this.#audio_controls.style.left = `${e.clientX + 20}px`;
                this.#audio_controls.style.top = `${e.clientY + 20}px`;
    
                // show controls
                this.#audio_controls.dataset.state = "";
            }
        });
    
        this.#mute_button.addEventListener("mousedown", () => this.#mute_audio(true));
        this.#unmute_button.addEventListener("mousedown", () => this.#mute_audio(false));
    
        this.#crop_button.addEventListener("click", () => {
            if (this.#cropping_audio && this.#cropping_audio.dataset.id != this.#audio_controls.dataset.audioid) {
                // deactivate crop if another crop tool is activated
                this.#cropping_audio.querySelector(".crop-tool").dataset.state = "inactive";
            }
    
            this.#cropping_audio = this.#track_list.querySelector(`.audio-wrapper[data-id="${this.#audio_controls.dataset.audioid}"]`);
            const crop_tool = this.#cropping_audio.querySelector(".crop-tool");
    
            if (crop_tool.dataset.state == "active") {
                this.#revert_crop(this.#cropping_audio.dataset.id);
    
                crop_tool.dataset.state = "inactive";
                this.#cropping_audio = null;
    
            } else {
                crop_tool.dataset.state = "active";
    
                this.#keep_audio_within_bounds(this.#cropping_audio.dataset.id);
            }
    
            this.#audio_controls.dataset.state = "hidden";
        });
    
        this.#restore_button.addEventListener("click", () => {
            const audio_id = this.#audio_controls.dataset.audioid;
    
            this.#audio_map.get(audio_id).set("start", 0);
            this.#audio_map.get(audio_id).set("end", -1);
    
            this.#revert_crop(audio_id);
    
            this.#track_list.querySelector(`.audio-wrapper[data-id="${audio_id}"]`).classList.remove("cropped");
            this.#audio_controls.dataset.state = "hidden";
        });
    
        this.#volume.addEventListener("input", () => {
            this.#audio_map.get(this.#audio_controls.dataset.audioid).set("volume", this.#volume.value);
            this.#audio_map.get(this.#audio_controls.dataset.audioid).get("wavesurfer").setVolume(this.#volume.value);
        });
    
        document.addEventListener("click", () => {
            if (this.#audio_controls !== document.activeElement && !this.#audio_controls.contains(document.activeElement)) {
                this.#audio_controls.dataset.state = "hidden";
            }
        });
    
        this.#play_button.addEventListener("click", () => {
            if (this.#demo_playing) {
                this.#demo_playing = false;
                this.#play_button.firstChild.classList.remove("icon__pause");

                return;
            }

            this.#demo_playing = true;
            this.#play_button.firstChild.classList.add("icon__pause");
            
            let track_width = parseInt(this.#track_list.getBoundingClientRect().width);
            let slider_position = this.#slider.style.left === "" ? 0 : parseInt(this.#slider.style.left);
            this.#slider.style.left = `${slider_position}px`;
    
            let play_audio = new Map();
    
            this.#mixer.querySelectorAll('.audio-wrapper:not([data-muted="true"])').forEach((elem) => {
                const audio_width = parseInt(this.#get_custom_property("--_audio-width", elem.style.cssText));
                const left_crop = parseInt(this.#get_custom_property("--_left", elem.style.cssText));
                const right_crop = parseInt(this.#get_custom_property("--_right", elem.style.cssText));
                const audio_data = this.#audio_map.get(elem.dataset.id);
                const wavesurfer = audio_data.get("wavesurfer");
                
                let audio_start = elem.style.left === "" ? 0 : parseInt(elem.style.left);
                audio_start += left_crop;
    
                const audio_end = audio_start + right_crop - left_crop;
    
                // set audio delays
                if (slider_position < audio_end) {
                    let delay;
                    // audio needs to be played
                    play_audio.set(elem.dataset.id, true);
    
                    if (slider_position > audio_start) {
                        // slider is in the middle of current audio file, set playback position
                        // const audio_ratio = (slider_position - audio_start) / (audio_end - audio_start);
                        const audio_ratio = (slider_position - audio_start + left_crop) / (audio_width);
                        wavesurfer.setTime(wavesurfer.getDuration() * audio_ratio);
                        
                        delay = 0;
                    } else {
                        // audio occurs later and needs a delay
                        wavesurfer.setTime(audio_data.get("start") / 1000);
                        
                        const ratio = (audio_start - slider_position) / track_width;
                        delay = ratio * this.#attributes.duration * 1000; // convert s to ms
                    }
    
                    this.#audio_map.get(elem.dataset.id).set("delay", delay);
                }
            });
    
            // play audio outside of the config/preprocess forEach because setTime() takes a nonnegligible length of time to complete, even for small audio file sets
            // goal: reduce synchronization issues between audio progress relative to other files
            // okay turns out the main problem was the audio drivers going to sleep but this still makes sense to do
            let timeouts = [];
            let _this = this;
    
            function play_track() {
                for (const [k, v] of _this.#audio_map.entries()) {
                    if (!v.get("muted") && play_audio.get(k)) {
                        const wavesurfer = v.get("wavesurfer");
                        const end = v.get("end");
                        const delay = v.get("delay");
                        const current_time = wavesurfer.getCurrentTime() * 1000;
            
                        const t = setTimeout(() => {
                            wavesurfer.play();
                        }, delay);
                        
                        timeouts.push(t);
            
                        if (end != -1) {
                            const t2 = setTimeout(() => {
                                wavesurfer.pause();
                            }, delay + end - current_time);
            
                            timeouts.push(t2);
                        }
                    }
                }
            
                // duration, interval in ms
                const interval = 50;
                let remaining_duration = (track_width - slider_position) / track_width * _this.#attributes.duration * 1000;
            
                let expected = Date.now() + interval;
            
                // self-adjusting timer
                setTimeout(while_delay, interval);
                function while_delay() {
                    let track_width = _this.#track_list.getBoundingClientRect().width; // continuously update to handle user zooming while audio playing
                    let pixels_per_interval = track_width / _this.#attributes.duration * interval / 1000;
                    let time_delta = Date.now() - expected;
                    if (time_delta > interval) expected += time_delta;
                    
                    slider_position += pixels_per_interval;
                    _this.#slider.style.left = `${slider_position}px`;
                    _this.#time_controls.value = slider_position / track_width * 100;
            
                    // scroll with the slider as it's about to leave the view
                    const scroll_width = _this.#scroll_container.getBoundingClientRect().width;
                    if (slider_position > (_this.#scroll_container.scrollLeft + (0.8 * scroll_width))) {
                        _this.#scroll_container.scrollLeft = slider_position - (0.2 * scroll_width);
                    }
            
                    if (!_this.#demo_playing) {
                        // user interrups playback, stop all tracks
                        for (const [k, v] of _this.#audio_map.entries()) {
                            v.get("wavesurfer").pause();
                        }
            
                        // prevent any audio playback not yet triggered from firing
                        timeouts.forEach((t) => {
                            clearTimeout(t);
                        });
            
                        _this.#phantom_audio.pause();
                        _this.#phantom_audio.currentTime = 0;
            
                        return;
                    } else if ((remaining_duration -= interval) > 0) {
                        // track hasn't finished, continue playing
                        expected += interval;
                        setTimeout(while_delay, Math.max(0, interval - time_delta));
                    } else {
                        // demo reached "EOF"
                        _this.#demo_playing = false;
                        _this.#play_button.firstChild.classList.remove("icon__pause");
                        _this.#slider.style.left = `${track_width}px`;
            
                        _this.#phantom_audio.pause();
                        _this.#phantom_audio.currentTime = 0;
            
                        return;
                    }
                }
            }
    
            function wait_for_drivers() {
                if (_this.#phantom_audio.currentTime > 0) {
                    _this.#phantom_audio.removeEventListener("timeupdate", wait_for_drivers);
                    play_track();
                }
            }
    
            _this.#phantom_audio.play();
            _this.#phantom_audio.addEventListener("timeupdate", wait_for_drivers);
        });
    }
}