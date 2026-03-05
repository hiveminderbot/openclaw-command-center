/**
 * Error Handler Middleware
 */

function errorHandler(err, req, res) {
  console.error("[Error]", err.message);
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: err.message }));
}

module.exports = { errorHandler };
