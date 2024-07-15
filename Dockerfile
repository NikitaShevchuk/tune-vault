FROM node:20-alpine

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .
# Cpoy the .env file
COPY .env.prod .env

# Change ownership of the /app directory to the non-root user
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Expose the port on which the application will run
EXPOSE $PORT

# Start the application
CMD [ "npm", "run", "start" ]
