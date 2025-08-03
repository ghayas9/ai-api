const express = require('express');
const app = express();
const cors = require("cors");
const { HUGGINGFACE_API_KEY, PORT } = require('./config');
const image = require("./app/service/image.service")

app.use(cors({
    origin: "*"
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    res.json({
        success: true,
        message: "server is working"
    })
})

app.use("/api/v1/image", image)

// Helper function to fetch image from URL and convert to blob
async function fetchImageAsBlob(imageUrl) {
    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('URL does not point to a valid image file');
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: contentType });

        return blob;
    } catch (error) {
        throw new Error(`Error fetching image from URL: ${error.message}`);
    }
}

async function fetchAudioAsBlob(audioUrl) {
    try {
        const response = await fetch(audioUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('audio/')) {
            throw new Error('URL does not point to a valid audio file');
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: contentType });

        return blob;
    } catch (error) {
        throw new Error(`Error fetching audio from URL: ${error.message}`);
    }
}

// POST endpoint for BiRefNet image processing
app.post('/bg-remover', async (req, res) => {
    try {
        // Check if image URL was provided
        if (!req.body.url) {
            return res.status(400).json({
                success: false,
                error: 'No image URL provided',
                message: 'Please provide an imageUrl in the request body'
            });
        }

        const { url } = req.body;

        // Get parameters from request body (with defaults)
        const resolution = req.body.resolution || "1024x1024";
        const weights_file = req.body.weights_file || "General";

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format',
                message: 'Please provide a valid image URL'
            });
        }

        // Fetch image from URL and convert to blob
        console.log('Fetching image from URL...');
        const imageBlob = await fetchImageAsBlob(url);

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the Gradio client
        console.log('Connecting to BiRefNet...');
        const client = await Client.connect("ZhengPeng7/BiRefNet_demo", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Make the prediction
        console.log('Processing image...');
        const result = await client.predict("/image", {
            images: imageBlob,
            resolution: resolution,
            weights_file: weights_file,
        });

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data[0],
            parameters: {
                resolution: resolution,
                weights_file: weights_file,
                source_url: url
            },
            message: 'Image processed successfully'
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Image processing failed'
        });
    }
});

app.post('/image/generate', async (req, res) => {
    try {
        // Check if image URL was provided
        if (!req.body.prompt) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an prompt in the request body'
            });
        }

        const { prompt } = req.body;


        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        const client = await Client.connect("black-forest-labs/FLUX.1-schnell", {
            hf_token: HUGGINGFACE_API_KEY
        });


        const result = await client.predict("/infer", {
            prompt,
            seed: 0,
        });

        res.json({
            success: true,
            data: result,
            message: 'Image Generated successfully'
        });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Image Generate failed'
        });
    }
});

app.post('/3d/generate', async (req, res) => {
    try {
        // Validate input
        if (!req.body.url && !req.body.images) {
            return res.status(400).json({
                success: false,
                error: 'No images provided',
                message: 'Please provide either a single URL or multiple image URLs'
            });
        }

        const { Client } = await import('@gradio/client');
        const client = await Client.connect("trellis-community/TRELLIS", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Start session
        await client.predict("/start_session", {});

        let imageBlob = null;
        let multiimages = [];
        const isMultiImageMode = Array.isArray(req.body.images) && req.body.images.length > 0;

        // Handle image processing based on input type
        if (isMultiImageMode) {
            // Process multiple images
            for (const imgUrl of req.body.images) {
                try {
                    new URL(imgUrl);
                } catch {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid URL in images array',
                        message: `Invalid image URL: ${imgUrl}`
                    });
                }
            }

            // Create multiimages structure
            multiimages = req.body.images.map(imgUrl => ({
                image: {
                    path: imgUrl,
                    meta: { _type: "gradio.FileData" },
                    orig_name: imgUrl.substring(imgUrl.lastIndexOf('/') + 1) || "image.png",
                    url: imgUrl
                }
            }));

            // Use first image for the main blob
            const response = await fetch(req.body.images[0]);
            imageBlob = await response.blob();
        } else {
            // Process single image
            try {
                new URL(req.body.url);
            } catch {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid URL format',
                    message: 'Please provide a valid image URL'
                });
            }

            const response = await fetch(req.body.url);
            imageBlob = await response.blob();
        }

        // Generate 3D asset
        const result = await client.predict("/generate_and_extract_glb", {
            image: imageBlob,
            multiimages: isMultiImageMode ? multiimages : [],
            seed: req.body.seed || 0,
            ss_guidance_strength: req.body.ss_guidance_strength || 7.5,
            ss_sampling_steps: req.body.ss_sampling_steps || 12,
            slat_guidance_strength: req.body.slat_guidance_strength || 3,
            slat_sampling_steps: req.body.slat_sampling_steps || 12,
            multiimage_algo: req.body.multiimage_algo || "stochastic",
            mesh_simplify: req.body.mesh_simplify || 0.95,
            texture_size: req.body.texture_size || 1024
        });


        res.json({
            success: true,
            data: result.data,
            message: '3D model generated successfully'
        });

    } catch (err) {
        console.error('Error generating 3D model:', err);
        res.status(500).json({
            success: false,
            error: err.message || JSON.stringify(err),
            message: '3D model generation failed'
        });
    }
});


app.post('/image/edit', async (req, res) => {
    try {
        // Check if required fields are provided
        if (!req.body.url) {
            return res.status(400).json({
                success: false,
                error: 'No image URL provided',
                message: 'Please provide an image URL in the request body'
            });
        }

        if (!req.body.prompt) {
            return res.status(400).json({
                success: false,
                error: 'No prompt provided',
                message: 'Please provide a prompt in the request body'
            });
        }

        const { url, prompt } = req.body;

        // Get parameters from request body with defaults
        const additional_prompt = req.body.additional_prompt || "best quality, extremely detailed";
        const negative_prompt = req.body.negative_prompt || "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality";
        const num_images = req.body.num_images || 1;
        const image_resolution = req.body.image_resolution || 768;
        const num_steps = req.body.num_steps || 20;
        const guidance_scale = req.body.guidance_scale || 9;
        const seed = req.body.seed || 0;
        const low_threshold = req.body.low_threshold || 100;
        const high_threshold = req.body.high_threshold || 200;

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format',
                message: 'Please provide a valid image URL'
            });
        }

        // Fetch image from URL and convert to blob
        console.log('Fetching image from URL for editing...');
        const imageBlob = await fetchImageAsBlob(url);

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the ControlNet client
        console.log('Connecting to ControlNet...');
        const client = await Client.connect("hysts/ControlNet-v1-1", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Make the prediction using Canny edge detection
        console.log('Processing image with ControlNet...');
        const result = await client.predict("/canny", {
            image: imageBlob,
            prompt: prompt,
            additional_prompt: additional_prompt,
            negative_prompt: negative_prompt,
            num_images: num_images,
            image_resolution: image_resolution,
            num_steps: num_steps,
            guidance_scale: guidance_scale,
            seed: seed,
            low_threshold: low_threshold,
            high_threshold: high_threshold
        });

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data,
            parameters: {
                prompt: prompt,
                additional_prompt: additional_prompt,
                negative_prompt: negative_prompt,
                num_images: num_images,
                image_resolution: image_resolution,
                num_steps: num_steps,
                guidance_scale: guidance_scale,
                seed: seed,
                low_threshold: low_threshold,
                high_threshold: high_threshold,
                source_url: url
            },
            message: 'Image edited successfully using ControlNet Canny'
        });

    } catch (err) {
        console.error('Error in image editing:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Image editing failed'
        });
    }
});

app.post('/image/colorize', async (req, res) => {
    try {
        // Check if image URL was provided
        if (!req.body.url) {
            return res.status(400).json({
                success: false,
                error: 'No image URL provided',
                message: 'Please provide an image URL in the request body'
            });
        }

        const { url } = req.body;

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format',
                message: 'Please provide a valid image URL'
            });
        }

        // Fetch image from URL and convert to blob
        console.log('Fetching image from URL for colorization...');
        const imageBlob = await fetchImageAsBlob(url);

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the old photo restoration client
        console.log('Connecting to old photo restoration service...');
        const client = await Client.connect("Greff3/old_photo_restoration", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Make the prediction for old photo restoration/colorization
        console.log('Processing image for colorization/restoration...');
        const result = await client.predict("/predict", {
            image: imageBlob
        });

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data,
            parameters: {
                source_url: url
            },
            message: 'Image colorized/restored successfully'
        });

    } catch (err) {
        console.error('Error in image colorization:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Image colorization failed'
        });
    }
});


app.post('/image/add/object', async (req, res) => {
    try {
        // Check if required fields are provided
        if (!req.body.url) {
            return res.status(400).json({
                success: false,
                error: 'No image URL provided',
                message: 'Please provide a source image URL in the request body'
            });
        }

        if (!req.body.prompt_source) {
            return res.status(400).json({
                success: false,
                error: 'No source prompt provided',
                message: 'Please provide a prompt_source in the request body'
            });
        }

        if (!req.body.prompt_target) {
            return res.status(400).json({
                success: false,
                error: 'No target prompt provided',
                message: 'Please provide a prompt_target in the request body'
            });
        }

        if (!req.body.subject_token) {
            return res.status(400).json({
                success: false,
                error: 'No subject token provided',
                message: 'Please provide a subject_token in the request body'
            });
        }

        const {
            url,
            prompt_source,
            prompt_target,
            subject_token
        } = req.body;

        // Get parameters from request body with defaults
        const seed_src = req.body.seed_src || 3;
        const seed_obj = req.body.seed_obj || 3;
        const extended_scale = req.body.extended_scale || 1;
        const structure_transfer_step = req.body.structure_transfer_step || 0;
        const blend_steps = req.body.blend_steps || "auto";
        const localization_model = req.body.localization_model || "attention";
        const use_offset = req.body.use_offset !== undefined ? req.body.use_offset : true;
        const disable_inversion = req.body.disable_inversion !== undefined ? req.body.disable_inversion : true;

        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format',
                message: 'Please provide a valid image URL'
            });
        }

        // Fetch image from URL and convert to blob
        console.log('Fetching image from URL for object addition...');
        const imageBlob = await fetchImageAsBlob(url);

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the NVIDIA AddIt client
        console.log('Connecting to NVIDIA AddIt service...');
        const client = await Client.connect("nvidia/addit", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Make the prediction for adding objects to image
        console.log('Processing image for object addition...');
        const result = await client.predict("/process_real_image", {
            source_image: imageBlob,
            prompt_source: prompt_source,
            prompt_target: prompt_target,
            subject_token: subject_token,
            seed_src: seed_src,
            seed_obj: seed_obj,
            extended_scale: extended_scale,
            structure_transfer_step: structure_transfer_step,
            blend_steps: blend_steps,
            localization_model: localization_model,
            use_offset: use_offset,
            disable_inversion: disable_inversion
        });

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data,
            parameters: {
                prompt_source: prompt_source,
                prompt_target: prompt_target,
                subject_token: subject_token,
                seed_src: seed_src,
                seed_obj: seed_obj,
                extended_scale: extended_scale,
                structure_transfer_step: structure_transfer_step,
                blend_steps: blend_steps,
                localization_model: localization_model,
                use_offset: use_offset,
                disable_inversion: disable_inversion,
                source_url: url
            },
            message: 'Object added to image successfully'
        });

    } catch (err) {
        console.error('Error in adding object to image:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Adding object to image failed'
        });
    }
});


// POST endpoint for music generation using Facebook MusicGen
app.get('/music/generate', async (req, res) => {
    try {
        // Check if description was provided
        // if (!req.body.prompt) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'No prompt provided',
        //         message: 'Please provide a prompt for the music in the request body'
        //     });
        // }

        // const { prompt } = req.body;
        // const { audio_url } = req.body; // Optional audio file URL for melody conditioning

        const prompt = "Memphis trap beat with a dark metallic sound"
        const audio_url = ""

        console.log('Starting music generation...');

        // Dynamic import for ES modules in CommonJS
        const { client } = await import('@gradio/client');

        // Connect to the Facebook MusicGen client
        console.log('Connecting to Facebook MusicGen...');
        const app = await client("https://facebook-musicgen.hf.space/");

        let audioBlob = null;

        // If audio URL is provided, fetch it; otherwise use the default example
        if (audio_url) {
            try {
                new URL(audio_url);
                console.log('Fetching custom audio from URL...');
                audioBlob = await fetchAudioAsBlob(audio_url);
            } catch (urlError) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid audio URL format',
                    message: 'Please provide a valid audio URL'
                });
            }
        } else {
            // Use the default example audio
            console.log('Using default example audio...');
            const response_0 = await fetch("https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav");
            audioBlob = await response_0.blob();
        }

        // Make the prediction for music generation
        console.log('Generating music...');
        const result = await app.predict(0, [
            prompt,    // string in 'Describe your music' Textbox component
            audioBlob,      // blob in 'File' Audio component
        ]);

        console.log('Music generation completed');

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data,
            message: 'Music generated successfully'
        });

    } catch (err) {
        console.error('Error in music generation:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Music generation failed'
        });
    }
});

app.post('/video/generate', async (req, res) => {
    try {
        // Check if text/story was provided
        if (!req.body.text) {
            return res.status(400).json({
                success: false,
                error: 'No text provided',
                message: 'Please provide a text/story in the request body'
            });
        }

        const { text } = req.body;

        // Get parameters from request body with defaults
        const base_model_name = req.body.base_model_name || "Realistic";
        const motion_name = req.body.motion_name || "";
        const num_inference_steps_backend = req.body.num_inference_steps_backend || 4;
        const randomize_seed = req.body.randomize_seed !== undefined ? req.body.randomize_seed : true;
        const seed = req.body.seed || 42;
        const width = req.body.width || 640;
        const height = req.body.height || 480;

        console.log('Starting video generation from story...');

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the Video Generator client
        console.log('Connecting to Video Generator...');
        const client = await Client.connect("ruslanmv/Video-Generator-from-Story", {
            hf_token: HUGGINGFACE_API_KEY
        });

        // Make the prediction for video generation
        console.log('Generating video from story...');
        const result = await client.predict("/get_output_video", {
            text: text,
            base_model_name: base_model_name,
            motion_name: motion_name,
            num_inference_steps_backend: num_inference_steps_backend,
            randomize_seed: randomize_seed,
            seed: seed,
            width: width,
            height: height
        });

        console.log('Video generation completed');

        // Return the result as JSON
        res.json({
            success: true,
            data: result?.data,
            parameters: {
                text: text,
                base_model_name: base_model_name,
                motion_name: motion_name,
                num_inference_steps_backend: num_inference_steps_backend,
                randomize_seed: randomize_seed,
                seed: seed,
                width: width,
                height: height
            },
            message: 'Video generated successfully from story'
        });

    } catch (err) {
        console.error('Error in video generation:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Video generation failed'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;