import { URL } from 'url';
import { VercelRequest } from '@vercel/node';
import { RequestParams } from '../types';

// Function to get user from the request
const getUserFromRequest = (req: VercelRequest): { status: boolean; userName: string } => {
	const userName = (req.headers['user'] as string) || req.body?.user || req.query?.user || 'anonymous';
	const status = !!(req.headers['user'] || req.body?.user || req.query?.user);
	return { status, userName };
};

// Function to extract parameters from both the query string and the request body
const extractParams = (req: VercelRequest, key: string) => {
	return req.body?.[key] || req.query?.[key] || undefined;
};

// Helper function to consolidate and check parameters for file URL operations
export const getParamsFromRequest = (req: VercelRequest): RequestParams => {
	const fileUrl = extractParams(req, 'fileUrl');
	const base64File = extractParams(req, 'base64File');
	const fileUrls = extractParams(req, 'fileUrls');
	const fileNames = extractParams(req, 'fileNames');

	if (!fileUrl && !base64File && !fileUrls) {
		throw new Error('File URL is required but was not provided.');
	}

	let fileName = extractParams(req, 'fileName');
	if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
		try {
			const url = new URL(fileUrl);
			fileName = url.pathname.split('/').pop(); // Extracts the last part of the pathname
		} catch (error) {
			// Only throw error if fileUrl is provided and invalid
			if (!fileUrls) {
				throw new Error('Invalid file URL provided.');
			}
		}
	}

	// Get the user from the request
	const { userName: user } = getUserFromRequest(req);
	const folderId = extractParams(req, 'folderId') || 'root'; // Default folderId to 'root' if not specified
	const folderName = extractParams(req, 'folderName');

	// Handle setPublic parameter, default to true
	const setPublicParam = extractParams(req, 'setPublic');
	const setPublic = setPublicParam === undefined ? true : setPublicParam === 'true' || setPublicParam === true; // Default to true if not specified

	// Handle reUpload parameter, default to false
	const reUploadParam = extractParams(req, 'reUpload');
	const reUpload = reUploadParam === undefined ? false : reUploadParam === 'true' || reUploadParam === true; // Default to false if not specified

	// Extract shareEmails parameter as an array
	const shareEmailsParam = extractParams(req, 'shareEmails');
	const shareEmails = Array.isArray(shareEmailsParam) ? shareEmailsParam : shareEmailsParam ? [shareEmailsParam] : [];

	// Construct the path array
	const path = folderName ? [user, folderName] : [user];

	return { base64File, fileUrl, fileUrls, fileNames, fileName, user, folderId, setPublic, reUpload, path, shareEmails };
};
