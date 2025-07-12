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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;