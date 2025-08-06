const cloudinary = require('cloudinary').v2;
const formidable = require('formidable');

// Version: 2025-01-27-v1 - Poster Processing Function
exports.handler = async function (event, context) {
    console.log('process-poster function called');
    
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Method not allowed'
            })
        };
    }

    try {
        // Check environment variables
        const required = [
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY',
            'CLOUDINARY_API_SECRET'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`
                })
            };
        }

        // Initialize Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // Parse multipart form data
        const form = formidable({});
        
        return new Promise((resolve, reject) => {
            form.parse(event, async (err, fields, files) => {
                if (err) {
                    console.error('Error parsing form data:', err);
                    resolve({
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: false,
                            error: 'Failed to parse form data',
                            message: err.message
                        })
                    });
                    return;
                }

                try {
                    // Get the uploaded file
                    const uploadedFile = files.poster || files.image || files.file;
                    
                    if (!uploadedFile) {
                        resolve({
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({
                                success: false,
                                error: 'No file uploaded',
                                message: 'Please select a poster image to upload'
                            })
                        });
                        return;
                    }

                    console.log('Processing uploaded file:', uploadedFile.originalFilename);

                    // Upload to Cloudinary
                    const uploadResult = await cloudinary.uploader.upload(uploadedFile.filepath, {
                        folder: 'event_posters',
                        transformation: [
                            { width: 800, height: 400, crop: 'fill', gravity: 'auto' },
                            { quality: 'auto', fetch_format: 'auto' }
                        ],
                        resource_type: 'image'
                    });

                    console.log('File uploaded to Cloudinary:', uploadResult.public_id);

                    // Extract basic information from the image (placeholder for AI processing)
                    const extractedData = {
                        imageUrl: uploadResult.secure_url,
                        publicId: uploadResult.public_id,
                        width: uploadResult.width,
                        height: uploadResult.height,
                        format: uploadResult.format,
                        
                        // Placeholder extracted data (in a real implementation, this would use AI/OCR)
                        extractedEventName: null,
                        extractedDate: null,
                        extractedTime: null,
                        extractedVenue: null,
                        extractedDescription: null,
                        
                        // Metadata
                        uploadedAt: new Date().toISOString(),
                        fileSize: uploadedFile.size,
                        originalFilename: uploadedFile.originalFilename
                    };

                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: true,
                            message: 'Poster uploaded successfully',
                            data: extractedData
                        })
                    });

                } catch (error) {
                    console.error('Error processing poster:', error);
                    resolve({
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: false,
                            error: 'Failed to process poster',
                            message: error.message
                        })
                    });
                }
            });
        });

    } catch (error) {
        console.error('Error in process-poster:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}; 