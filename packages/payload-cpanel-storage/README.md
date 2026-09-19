# @news-spend-media/payload-cpanel-storage

A production-ready Payload CMS storage adapter for cPanel hosting and SFTP servers.

## Features

- 🔌 **Connection Pooling** - Efficient connection reuse with configurable pool size
- 🔄 **Automatic Retry** - Exponential backoff for transient failures
- 🔒 **Security** - Path sanitization and validation to prevent directory traversal
- ❤️ **Health Checks** - Automatic connection health monitoring
- 🛡️ **Error Handling** - Comprehensive error handling with detailed logging
- 🚀 **Performance** - Redirect-based static file serving (optional proxying)
- 📊 **Observability** - Structured logging with `@news-spend-media/logger`
- 🔧 **TypeScript** - Full type safety and IntelliSense support
- ♻️ **Graceful Shutdown** - Proper cleanup on process termination

## Installation

```bash
bun add @news-spend-media/payload-cpanel-storage
```

## Quick Start

```typescript
import { buildConfig } from "payload/config";
import { cpanelSftpStorage } from "@news-spend-media/payload-cpanel-storage";

export default buildConfig({
  plugins: [
    cpanelSftpStorage({
      collections: {
        media: true,
        documents: true,
      },
      connection: {
        host: process.env.SFTP_HOST!,
        port: 22,
        username: process.env.SFTP_USERNAME!,
        password: process.env.SFTP_PASSWORD,
      },
      baseUrl: process.env.STORAGE_BASE_URL!,
      uploadDir: "/home/username/public_html/uploads",
    }),
  ],
});
```

## Configuration

### Required Options

#### `collections`

Collections to enable SFTP storage for:

```typescript
collections: {
  media: true,
  documents: {
    disableLocalStorage: true,
  },
}
```

#### `connection`

SFTP connection configuration (from `ssh2-sftp-client`):

```typescript
connection: {
  host: 'ftp.example.com',
  port: 22,
  username: 'user',
  password: 'password', // or use privateKey
  // privateKey: fs.readFileSync('/path/to/key'),
  // passphrase: 'key-passphrase',
}
```

**Authentication Methods:**

- **Password**: Use `password` field
- **SSH Key**: Use `privateKey` (Buffer or string) and optional `passphrase`
- **SSH Agent**: Use `agent` (e.g., `process.env.SSH_AUTH_SOCK`)

#### `baseUrl`

Public base URL where files will be accessible (no trailing slash):

```typescript
baseUrl: "https://example.com/uploads";
```

#### `uploadDir`

Upload directory on the SFTP server (absolute path, no trailing slash):

```typescript
uploadDir: "/home/username/public_html/uploads";
```

### Optional Options

#### `enabled`

Enable or disable the plugin (default: `true`):

```typescript
enabled: process.env.NODE_ENV === "production";
```

#### `pool`

Connection pool configuration:

```typescript
pool: {
  minConnections: 1,        // Minimum connections to maintain
  maxConnections: 10,       // Maximum connections allowed
  idleTimeoutMs: 60_000,    // Close connections idle for 1 minute
  connectionTimeoutMs: 30_000, // Connection timeout (30 seconds)
  healthCheckIntervalMs: 30_000, // Health check every 30 seconds
  debug: false,             // Enable debug logging
}
```

#### `static`

Static file handler configuration:

```typescript
static: {
  proxyFiles: false,  // If true, proxy files through server (default: redirect)
  cacheControl: 'public, max-age=31536000, immutable', // Cache headers
}
```

## Environment Variables

Create a `.env` file with:

```env
# SFTP Connection
SFTP_HOST=ftp.example.com
SFTP_PORT=22
SFTP_USERNAME=username
SFTP_PASSWORD=password

# Storage
STORAGE_BASE_URL=https://example.com/uploads
STORAGE_UPLOAD_DIR=/home/username/public_html/uploads
```

## Usage Examples

### Basic Configuration

```typescript
cpanelSftpStorage({
  collections: {
    media: true,
  },
  connection: {
    host: process.env.SFTP_HOST!,
    username: process.env.SFTP_USERNAME!,
    password: process.env.SFTP_PASSWORD!,
  },
  baseUrl: process.env.STORAGE_BASE_URL!,
  uploadDir: process.env.STORAGE_UPLOAD_DIR!,
});
```

### SSH Key Authentication

```typescript
import { readFileSync } from "node:fs";

cpanelSftpStorage({
  collections: { media: true },
  connection: {
    host: process.env.SFTP_HOST!,
    username: process.env.SFTP_USERNAME!,
    privateKey: readFileSync("/path/to/id_rsa"),
    passphrase: process.env.SSH_KEY_PASSPHRASE,
  },
  baseUrl: process.env.STORAGE_BASE_URL!,
  uploadDir: process.env.STORAGE_UPLOAD_DIR!,
});
```

### Advanced Configuration

```typescript
cpanelSftpStorage({
  collections: {
    media: {
      disableLocalStorage: true,
    },
    documents: true,
    avatars: true,
  },
  connection: {
    host: process.env.SFTP_HOST!,
    port: 2222, // Custom port
    username: process.env.SFTP_USERNAME!,
    password: process.env.SFTP_PASSWORD!,
    readyTimeout: 30_000,
    retries: 2,
  },
  baseUrl: "https://cdn.example.com/uploads",
  uploadDir: "/var/www/uploads",
  pool: {
    minConnections: 2,
    maxConnections: 20,
    idleTimeoutMs: 120_000,
    connectionTimeoutMs: 45_000,
    debug: process.env.NODE_ENV === "development",
  },
  static: {
    proxyFiles: false, // Use redirects for better performance
    cacheControl: "public, max-age=31536000, immutable",
  },
});
```

### Conditional Plugin

```typescript
const plugins = [];

if (process.env.NODE_ENV === "production") {
  plugins.push(
    cpanelSftpStorage({
      collections: { media: true },
      connection: {
        host: process.env.SFTP_HOST!,
        username: process.env.SFTP_USERNAME!,
        password: process.env.SFTP_PASSWORD!,
      },
      baseUrl: process.env.STORAGE_BASE_URL!,
      uploadDir: process.env.STORAGE_UPLOAD_DIR!,
    })
  );
}

export default buildConfig({
  plugins,
});
```

## How It Works

### File Upload Flow

1. File is received by Payload
2. Filename and path are sanitized for security
3. Connection is acquired from pool
4. Remote directory is created if it doesn't exist
5. File is uploaded with automatic retry on failures
6. Connection is released back to pool

### File Access Flow

**Default (Redirect Mode):**

1. Request comes to `/api/media/filename.jpg`
2. Handler returns 302 redirect to `https://cdn.example.com/uploads/media/filename.jpg`
3. Browser fetches file directly from CDN (no server load)

**Proxy Mode:**

1. Request comes to `/api/media/filename.jpg`
2. Server fetches file from CDN
3. Server streams file to client with cache headers

### Connection Pool

The plugin maintains a pool of reusable SFTP connections:

- **Min Connections**: Always maintained for quick access
- **Max Connections**: Upper limit to prevent resource exhaustion
- **Health Checks**: Periodic validation of connection health
- **Idle Timeout**: Closes unused connections after timeout
- **Auto-Reconnect**: Failed connections are replaced automatically

## Monitoring

### Connection Pool Stats

```typescript
import { getConnectionPool } from "@news-spend-media/payload-cpanel-storage";

const pool = getConnectionPool();
if (pool) {
  const stats = pool.getStats();
  console.log(stats);
  // {
  //   totalConnections: 5,
  //   activeConnections: 2,
  //   idleConnections: 3,
  //   healthyConnections: 5
  // }
}
```

### Manual Shutdown

```typescript
import { shutdownConnectionPool } from "@news-spend-media/payload-cpanel-storage";

// Gracefully close all connections
await shutdownConnectionPool();
```

## Error Handling

The plugin includes custom error types for debugging:

- `SftpConnectionError` - Connection failures
- `SftpUploadError` - Upload failures
- `SftpDeleteError` - Deletion failures
- `SftpConfigError` - Configuration errors
- `SftpPathError` - Path validation errors

All errors include detailed context for debugging:

```typescript
try {
  // Upload file
} catch (error) {
  if (error instanceof SftpUploadError) {
    console.error("Upload failed:", {
      filename: error.filename,
      code: error.code,
      cause: error.cause,
    });
  }
}
```

## Security

### Path Sanitization

All filenames and paths are sanitized to prevent:

- Directory traversal attacks (`../../../etc/passwd`)
- Path injection
- Invalid characters in filenames
- Overly long paths or filenames

### Best Practices

1. **Use SSH Keys**: More secure than passwords
2. **Restrict Permissions**: Limit SFTP user to upload directory only
3. **Use Environment Variables**: Never hardcode credentials
4. **Enable HTTPS**: Serve files over HTTPS in production
5. **Set Strong Passwords**: If using password auth, use strong passwords
6. **Monitor Logs**: Watch for suspicious activity

## Troubleshooting

### Connection Timeouts

Increase connection timeout:

```typescript
pool: {
  connectionTimeoutMs: 60_000, // 60 seconds
}
```

### Too Many Open Connections

Reduce max connections or increase idle timeout:

```typescript
pool: {
  maxConnections: 5,
  idleTimeoutMs: 30_000,
}
```

### Files Not Found

Check that `baseUrl` matches your server's public URL and `uploadDir` is correct:

```typescript
baseUrl: 'https://example.com/uploads', // No trailing slash
uploadDir: '/home/user/public_html/uploads', // Absolute path
```

### Permission Denied

Ensure SFTP user has write permissions:

```bash
chmod 755 /home/user/public_html/uploads
chown user:user /home/user/public_html/uploads
```

### Debug Mode

Enable debug logging:

```typescript
pool: {
  debug: true,
}
```

## Performance Tips

1. **Use Redirects**: Set `proxyFiles: false` (default) to avoid server load
2. **Increase Pool Size**: For high-traffic sites, increase `maxConnections`
3. **CDN**: Put a CDN (Cloudflare, etc.) in front of your storage URL
4. **Optimize Images**: Use Payload's image optimization features
5. **Cache Headers**: Use long cache times for immutable files

## Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions from local storage or other plugins.

## License

MIT

## Support

For issues and feature requests, please open an issue in the repository.
