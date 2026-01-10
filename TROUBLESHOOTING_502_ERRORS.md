# Troubleshooting 502 Bad Gateway Errors

## What is a 502 Bad Gateway Error?

A 502 Bad Gateway error occurs when nginx (our reverse proxy) cannot get a valid response from the application server. In our setup, this means nginx is running but cannot communicate with the `app` service.

## Recent Fixes Applied

We've implemented several fixes to prevent and better handle 502 errors:

1. **Server-level error handling in nginx**: Added error handling that catches connection failures before they reach the proxy, ensuring users see a proper JSON error message instead of a generic nginx error page.

2. **Improved health checks**: Extended the health check startup period to 180 seconds (3 minutes) and increased retries to 20, giving the application more time to fully start up.

3. **Better error logging**: Enhanced the health check endpoint to provide detailed logging about connection failures, including consecutive failure counts and whether the database connection has ever been established.

4. **Robust startup script**: Added better error handling and logging to the application startup process using `set -e` and `exec` to ensure proper process management.

5. **Retry logic in nginx**: Configured nginx to retry failed requests up to 3 times before returning an error to the client.

## Common Causes of 502 Errors

### 1. Application Not Started or Crashed
- The app container may not have started successfully
- The app may have crashed after starting
- Dependencies (database, Redis, MinIO) may not be available

### 2. Database Connection Issues
- PostgreSQL may not be responding
- Database connection pool may be exhausted
- Network issues between app and database containers

### 3. Slow Application Startup
- The application may still be installing dependencies
- The setup script may be running migrations
- The application may be warming up

### 4. Resource Constraints
- The server may be running out of memory
- CPU may be maxed out
- Disk space may be full

## Troubleshooting Steps

### Step 1: Check Service Status

Run this command to see which services are running:

```bash
docker compose ps
```

Look for the `app` service status. It should show as "healthy" once it's fully started.

### Step 2: View Application Logs

Check the app logs to see what's happening:

```bash
docker compose logs app
```

Look for:
- Error messages during startup
- Database connection errors
- Memory or resource issues
- Health check failures

To follow logs in real-time:

```bash
docker compose logs -f app
```

### Step 3: Check Health Endpoint Directly

If the app container is running, you can check the health endpoint directly:

```bash
docker compose exec app curl -f http://localhost:3000/health
```

This should return a JSON response with status "ok" if the application is healthy.

### Step 4: Check Database Connectivity

Verify that the database is accessible:

```bash
docker compose exec app curl -f http://localhost:3000/health
```

If this fails, check the PostgreSQL logs:

```bash
docker compose logs postgres
```

### Step 5: Check nginx Logs

View nginx logs to see what errors it's encountering:

```bash
docker compose logs nginx
```

Look for:
- Connection refused errors
- Timeout errors
- Upstream server errors

### Step 6: Restart Services

If the issue persists, try restarting the services:

```bash
# Restart just the app service
docker compose restart app

# Or restart all services
docker compose restart
```

### Step 7: Full Rebuild

If restarting doesn't help, try a full rebuild:

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: This will delete all data)
docker compose down -v

# Rebuild and start
docker compose up --build
```

## Understanding the Health Check

The application health check runs every 5 seconds and:

1. Makes a request to `http://localhost:3000/health`
2. Checks if the database is responding with a simple query
3. Returns a 200 status if healthy, 503 if unhealthy

The health check has:
- **Start period**: 180 seconds (3 minutes) - Time before health checks count as failures
- **Interval**: 5 seconds - How often to check
- **Timeout**: 5 seconds - Maximum time to wait for a response
- **Retries**: 20 - Number of consecutive failures before marking as unhealthy

This means the application has up to 3 minutes to start up, and then must pass 20 consecutive health checks (or fail them) before being marked as healthy or unhealthy.

## Monitoring Health Check Progress

To monitor the health check in real-time:

```bash
# Watch the health check logs
docker compose logs -f app | grep "Health Check"

# Check the current health status
docker compose ps app
```

## Preventing Future 502 Errors

1. **Monitor resource usage**: Ensure your server has enough memory and CPU
2. **Check logs regularly**: Look for warnings or errors in the application logs
3. **Keep dependencies updated**: Regularly update Docker images and npm packages
4. **Test after changes**: After making configuration changes, test the application thoroughly
5. **Use proper error handling**: Ensure all code has proper error handling to prevent crashes

## When to Seek Help

If you've tried all the troubleshooting steps and still see 502 errors:

1. Collect the following information:
   - Output of `docker compose ps`
   - Output of `docker compose logs app` (last 100 lines)
   - Output of `docker compose logs nginx` (last 50 lines)
   - Output of `docker compose logs postgres` (last 50 lines)
   - Any error messages you see in the browser console

2. Check if the issue is reproducible:
   - Does it happen every time or intermittently?
   - Does it happen after specific actions?
   - Did it start after a recent change?

3. Provide context:
   - When did the issue start?
   - What were you doing when it occurred?
   - Have you made any recent changes to the code or configuration?

## Additional Resources

- [Nginx documentation on 502 errors](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_intercept_errors)
- [Docker Compose health checks](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [Debugging Docker containers](https://docs.docker.com/config/containers/logging/)
