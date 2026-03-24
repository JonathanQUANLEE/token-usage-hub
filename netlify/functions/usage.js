const { buildUsageResponse } = require("../../lib/usage-core");

exports.handler = async function handler() {
  try {
    const payload = await buildUsageResponse();
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify(payload)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify({
        ok: false,
        generatedAt: new Date().toISOString(),
        providers: [],
        error: error.message || "Internal server error"
      })
    };
  }
};
