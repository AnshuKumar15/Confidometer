FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set dynamic relative base path for production build to avoid CORS and hardcoding IPs
ENV NEXT_PUBLIC_API_BASE=/api
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
