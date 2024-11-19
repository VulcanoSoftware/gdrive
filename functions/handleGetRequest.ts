import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { capitalize } from '../utils/capitalize';

export const handleGetRequest = async ({ request, response }: { request: VercelRequest; response: VercelResponse }): Promise<void> => {
	const filePath = path.join(__dirname, 'getContent.html');
	const { name } = request.query;
	const userName = Array.isArray(name) ? name[0] : name || '';
	const pageTitle = userName ? `Hello ${capitalize(userName)}!` : `🚀 Google Drive Uploader²`;
	const clusterName = process.env.APP_CLUSTER_NAME || 'Default Cluster';

	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			console.error('Error reading HTML file:', err);
			response.status(500).send('Error reading HTML file');
			return;
		}

		// Replace placeholders with actual values
		const htmlContent = data.replace('${pageTitle}', pageTitle).replace('${clusterName}', clusterName);

		response.setHeader('Content-Type', 'text/html');
		response.send(htmlContent);
	});
};
