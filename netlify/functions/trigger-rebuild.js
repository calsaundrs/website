exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }

    try {
        console.log('🔧 Manual rebuild trigger requested...');
        
        // Check if build hook URL is configured
        const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
        
        if (!buildHookUrl) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Build hook not configured',
                    message: 'NETLIFY_BUILD_HOOK_URL environment variable is not set'
                })
            };
        }

        // Trigger the build hook
        console.log('📡 Triggering build hook...');
        const response = await fetch(buildHookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const buildId = await response.text();
            console.log('✅ Build hook triggered successfully:', buildId);
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Build triggered successfully',
                    buildId: buildId,
                    note: 'This will regenerate all static pages with latest content'
                })
            };
        } else {
            throw new Error(`Build hook failed: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Error triggering build hook:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Build trigger failed',
                message: error.message
            })
        };
    }
}; 