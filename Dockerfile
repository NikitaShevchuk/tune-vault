FROM --platform=amd64 node:20-alpine

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory
WORKDIR /app

# Install app dependencies
RUN apk add ffmpeg
COPY package*.json /app
RUN npm install
RUN npx prisma generate

# Bundle app source
COPY . .

# Copy the script to apply migrations at etnrypoint
COPY migrate.sh /app/migrate.sh
RUN chmod +x /app/migrate.sh

# Change ownership of the /app directory to the non-root user
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Expose the port on which the application will run
EXPOSE 3000 

# Apply migrations
ENTRYPOINT ["/app/migrate.sh"]

# Start the application
CMD [  "npm", "run", "start" ]
