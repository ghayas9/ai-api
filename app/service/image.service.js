const express = require('express');
const router = express.Router();

// Tested image generation models configuration
const IMAGE_GENERATION_MODELS = {
    // Stability AI Stable Diffusion - TESTED ✅
    'stable-diffusion': {
        space: "stabilityai/stable-diffusion",
        endpoint: "/infer",
        params: {
            prompt: "",
            negative: "",
            scale: 7.5
        }
    },

    // FLUX.1 Dev - TESTED ✅
    'flux-dev': {
        space: "black-forest-labs/FLUX.1-dev",
        endpoint: "/infer",
        params: {
            seed: 0,
            randomize_seed: true,
            width: 1024,
            height: 1024,
            guidance_scale: 3.5,
            num_inference_steps: 28
        }
    },

    // FLUX.1 Schnell - TESTED ✅
    'flux-schnell': {
        space: "black-forest-labs/FLUX.1-schnell",
        endpoint: "/infer",
        params: {
            seed: 0,
            randomize_seed: true,
            width: 1024,
            height: 1024,
            num_inference_steps: 4
        }
    },

    // Midjourney Style - TESTED ✅
    'midjourney': {
        space: "ijohn07/Midjourney",
        endpoint: "/run",
        params: {
            negative_prompt: "",
            use_negative_prompt: true,
            style: "2560 x 1440",
            seed: 0,
            width: 512,
            height: 512,
            guidance_scale: 0.1,
            randomize_seed: true
        }
    }
};

// Main image generation endpoint
router.get('/generate', async (req, res) => {
    try {
        const { model = "flux-dev", prompt = "A highly detailed photograph of a red vintage bicycle leaning against a white brick wall, shot with professional camera, natural daylight, sharp focus, 8K resolution, no text or watermarks", ...otherParams } = req.body;

        // Validate required parameters
        if (!model) {
            return res.status(400).json({
                success: false,
                error: 'No model specified',
                message: 'Please provide a model name',
                available_models: Object.keys(IMAGE_GENERATION_MODELS)
            });
        }

        if (!IMAGE_GENERATION_MODELS[model]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid model',
                message: `Model '${model}' not found`,
                available_models: Object.keys(IMAGE_GENERATION_MODELS)
            });
        }

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'No prompt provided',
                message: 'Please provide a prompt for image generation'
            });
        }

        // Get model configuration
        const modelConfig = IMAGE_GENERATION_MODELS[model];

        // Merge default parameters with user-provided parameters
        const finalParams = { ...modelConfig.params, ...otherParams };

        // Dynamic import for ES modules in CommonJS
        const { Client } = await import('@gradio/client');

        // Connect to the specified Gradio space
        console.log(`Connecting to ${modelConfig.space}...`);
        const client = await Client.connect(modelConfig.space, {
            hf_token: process.env.HUGGINGFACE_API_KEY
        });

        // Prepare parameters based on specific model requirements
        let predictionParams = {};

        switch (model) {
            case 'stable-diffusion':
                predictionParams = {
                    prompt: prompt,
                    negative: finalParams.negative || "",
                    scale: finalParams.scale
                };
                break;

            case 'flux-dev':
                predictionParams = {
                    prompt: prompt,
                    seed: finalParams.seed,
                    randomize_seed: finalParams.randomize_seed,
                    width: finalParams.width,
                    height: finalParams.height,
                    guidance_scale: finalParams.guidance_scale,
                    num_inference_steps: finalParams.num_inference_steps
                };
                break;

            case 'flux-schnell':
                predictionParams = {
                    prompt: prompt,
                    seed: finalParams.seed,
                    randomize_seed: finalParams.randomize_seed,
                    width: finalParams.width,
                    height: finalParams.height,
                    num_inference_steps: finalParams.num_inference_steps
                };
                break;

            case 'midjourney':
                predictionParams = {
                    prompt: prompt,
                    negative_prompt: finalParams.negative_prompt || "",
                    use_negative_prompt: finalParams.use_negative_prompt,
                    style: finalParams.style,
                    seed: finalParams.seed,
                    width: finalParams.width,
                    height: finalParams.height,
                    guidance_scale: finalParams.guidance_scale,
                    randomize_seed: finalParams.randomize_seed
                };
                break;

            default:
                predictionParams = {
                    prompt: prompt,
                    ...finalParams
                };
                break;
        }

        // Make the prediction
        console.log(`Generating image with ${model}...`);
        console.log('Parameters:', predictionParams);

        const result = await client.predict(modelConfig.endpoint, predictionParams);

        console.log(result?.data, "")

        // Return the result
        res.json({
            success: true,
            model: model,
            data: result?.data,
            parameters: {
                model: model,
                prompt: prompt,
                ...finalParams
            },
            message: `Image generated successfully with ${model}`
        });

    } catch (err) {
        console.error('Error in image generation:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Image generation failed'
        });
    }
});

// Get available models
router.get('/models', (req, res) => {
    const modelsList = Object.keys(IMAGE_GENERATION_MODELS).map(key => ({
        name: key,
        space: IMAGE_GENERATION_MODELS[key].space,
        endpoint: IMAGE_GENERATION_MODELS[key].endpoint,
        description: getModelDescription(key),
        status: 'TESTED ✅',
        default_params: IMAGE_GENERATION_MODELS[key].params,
        example_usage: getExampleUsage(key)
    }));

    res.json({
        success: true,
        total_models: modelsList.length,
        models: modelsList
    });
});

// Helper function to get model descriptions
function getModelDescription(modelName) {
    const descriptions = {
        'stable-diffusion': 'Stability AI Stable Diffusion - Classic text-to-image model',
        'flux-dev': 'FLUX.1 Dev - High-quality balanced generation model',
        'flux-schnell': 'FLUX.1 Schnell - Fast 4-step generation model',
        'midjourney': 'Midjourney Style - Artistic and aesthetic image generation'
    };

    return descriptions[modelName] || 'AI image generation model';
}

// Helper function to get example usage
function getExampleUsage(modelName) {
    const examples = {
        'stable-diffusion': {
            prompt: "A beautiful landscape with mountains and sunset",
            negative: "blurry, low quality, distorted",
            scale: 7.5
        },
        'flux-dev': {
            prompt: "A photorealistic portrait of a person",
            seed: 42,
            randomize_seed: false,
            width: 1024,
            height: 1024,
            guidance_scale: 3.5,
            num_inference_steps: 28
        },
        'flux-schnell': {
            prompt: "A cute cat sitting on a chair",
            seed: 0,
            randomize_seed: true,
            width: 1024,
            height: 1024,
            num_inference_steps: 4
        },
        'midjourney': {
            prompt: "A mystical landscape with floating islands",
            negative_prompt: "blurry, low quality",
            use_negative_prompt: true,
            style: "2560 x 1440",
            seed: 42,
            width: 512,
            height: 512,
            guidance_scale: 0.1,
            randomize_seed: false
        }
    };

    return examples[modelName] || {};
}


module.exports = router;