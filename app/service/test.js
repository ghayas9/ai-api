// from gradio_client import Client, handle_file

// client = Client("AP123/IllusionDiffusion")
// result = client.predict(
// 		control_image=handle_file('https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png'),
// 		prompt="Hello!!",
// 		negative_prompt="low quality",
// 		guidance_scale=7.5,
// 		controlnet_conditioning_scale=0.8,
// 		control_guidance_start=0,
// 		control_guidance_end=1,
// 		upscaler_strength=1,
// 		seed=-1,
// 		sampler="Euler",
// 		api_name="/inference"
// )
// print(result)

// from gradio_client import Client, handle_file

// client = Client("InstantX/InstantID")
// result = client.predict(
// 		face_image_path=handle_file('https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png'),
// 		pose_image_path=handle_file('https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png'),
// 		prompt="",
// 		negative_prompt="(lowres, low quality, worst quality:1.2), (text:1.2), watermark, (frame:1.2), deformed, ugly, deformed eyes, blur, out of focus, blurry, deformed cat, deformed, photo, anthropomorphic cat, monochrome, pet collar, gun, weapon, blue, 3d, drones, drone, buildings in background, green",
// 		style_name="Spring Festival",
// 		num_steps=30,
// 		identitynet_strength_ratio=0.8,
// 		adapter_strength_ratio=0.8,
// 		canny_strength=0.4,
// 		depth_strength=0.4,
// 		controlnet_selection=["depth"],
// 		guidance_scale=5,
// 		seed=42,
// 		scheduler="EulerDiscreteScheduler",
// 		enable_LCM=False,
// 		enhance_face_region=True,
// 		api_name="/generate_image"
// )
// print(result)

// for svgs
// https://huggingface.co/spaces/multimodalart/OmniSVG-3B
// import { Client } from "@gradio/client";

// const client = await Client.connect("multimodalart/OmniSVG-3B");
// const result = await client.predict("/gradio_text_to_svg", {
// 		text_description: "Hello!!",
// });

// console.log(result.data);


// const response = await fetch(
//     "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
//     {
//         headers: {
//             Authorization: `Bearer ${config.app.HUGGINGFACE_API_KEY || ""}`,
//             "Content-Type": "application/json",
//         },
//         method: "POST",
//         body: JSON.stringify({ inputs: prompt }),
//     },
// );

// if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(`API returned error: ${response.status} - ${errorText}`);
// }

// // Get the image blob directly
// const imageBlob = await response.blob();