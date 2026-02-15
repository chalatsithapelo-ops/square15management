#!/bin/bash
# Add APK download location to nginx config

NGINX_CONF="/etc/nginx/sites-enabled/square15management"

# Check if APK location already exists
if grep -q "square15-app.apk" "$NGINX_CONF"; then
    echo "APK location already configured in nginx"
else
    # Insert APK location block before the main location / block
    sed -i '/location \/ {/i \    location /square15-app.apk {\
        alias /root/square15management/public/square15-app.apk;\
        default_type application/vnd.android.package-archive;\
        add_header Content-Disposition "attachment; filename=Square15.apk";\
    }' "$NGINX_CONF"
    
    echo "Added APK location to nginx config"
fi

# Test and reload
nginx -t && systemctl reload nginx && echo "NGINX UPDATED SUCCESSFULLY"
