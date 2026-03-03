# run with below commands:
# docker build -t jumpflix .
# docker run --rm -p 5173:5173 -v $(pwd):/app -v /app/node_modules jumpflix

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
