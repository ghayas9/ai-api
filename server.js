const express = require('express');
const app = express();
const cors = require("cors");
const { HUGGINGFACE_API_KEY, PORT } = require('./config');

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

app.use("/api/v1", (req, res, next) => {
    next();
});

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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;