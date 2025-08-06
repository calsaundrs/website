const RecurringEventsManager = require('./services/recurring-events-manager');

// Version: 2025-01-27-v1 - Recurring Events Management Function
exports.handler = async function (event, context) {
    console.log('manage-recurring-events function called');
    
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: ''
        };
    }

    try {
        const recurringManager = new RecurringEventsManager();
        const { action } = JSON.parse(event.body || '{}');

        console.log(`Recurring events action: ${action}`);

        switch (action) {
            case 'create-series':
                return await handleCreateSeries(recurringManager, event.body);
            case 'update-series':
                return await handleUpdateSeries(recurringManager, event.body);
            case 'end-series':
                return await handleEndSeries(recurringManager, event.body);
            case 'get-instances':
                return await handleGetInstances(recurringManager, event.body);
            case 'get-stats':
                return await handleGetStats(recurringManager);
            default:
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'Invalid action',
                        message: 'Supported actions: create-series, update-series, end-series, get-instances, get-stats'
                    })
                };
        }

    } catch (error) {
        console.error('Error in manage-recurring-events:', error);
        
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

async function handleCreateSeries(recurringManager, body) {
    try {
        const { seriesData } = JSON.parse(body);
        
        if (!seriesData) {
            throw new Error('Missing seriesData');
        }

        const result = await recurringManager.createRecurringSeries(seriesData);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: `Created recurring series with ${result.totalInstances} instances`,
                data: result
            })
        };

    } catch (error) {
        console.error('Error creating recurring series:', error);
        
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to create recurring series',
                message: error.message
            })
        };
    }
}

async function handleUpdateSeries(recurringManager, body) {
    try {
        const { recurringGroupId, updates } = JSON.parse(body);
        
        if (!recurringGroupId || !updates) {
            throw new Error('Missing recurringGroupId or updates');
        }

        const result = await recurringManager.updateRecurringSeries(recurringGroupId, updates);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: result.message,
                data: result
            })
        };

    } catch (error) {
        console.error('Error updating recurring series:', error);
        
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to update recurring series',
                message: error.message
            })
        };
    }
}

async function handleEndSeries(recurringManager, body) {
    try {
        const { recurringGroupId } = JSON.parse(body);
        
        if (!recurringGroupId) {
            throw new Error('Missing recurringGroupId');
        }

        const result = await recurringManager.endRecurringSeries(recurringGroupId);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: result.message,
                data: result
            })
        };

    } catch (error) {
        console.error('Error ending recurring series:', error);
        
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to end recurring series',
                message: error.message
            })
        };
    }
}

async function handleGetInstances(recurringManager, body) {
    try {
        const { recurringGroupId, options = {} } = JSON.parse(body);
        
        if (!recurringGroupId) {
            throw new Error('Missing recurringGroupId');
        }

        const instances = await recurringManager.getRecurringSeriesInstances(recurringGroupId, options);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: {
                    recurringGroupId,
                    instances,
                    count: instances.length
                }
            })
        };

    } catch (error) {
        console.error('Error getting recurring instances:', error);
        
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to get recurring instances',
                message: error.message
            })
        };
    }
}

async function handleGetStats(recurringManager) {
    try {
        const stats = await recurringManager.getRecurringStats();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                data: stats
            })
        };

    } catch (error) {
        console.error('Error getting recurring stats:', error);
        
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to get recurring stats',
                message: error.message
            })
        };
    }
} 