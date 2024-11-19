import { Readable } from 'stream';
import { drive_v3 } from 'googleapis';
import { VercelRequest } from '@vercel/node';
import { getDriveClient } from '../utils/getDriveClient';
import { checkIfFileExists } from '../utils/checkIfFileExists';
import { setFilePermissions } from '../utils/setFilePermissions';
import { getParamsFromRequest } from '../utils/getParamsFromRequest';
import { FileDocument, RequestParams } from '../types';
import { gdriveResultFields as fields } from '../utils/gdriveResultFields';
import { connectToMongo, saveFileRecordToDB } from '../utils/mongo';
import { getMimeType } from '../utils/getMimeTypes';

export async function uploadBase64ToGoogleDrive(
	req: VercelRequest
): Promise<{ status: boolean; fileDocument: FileDocument | null; reUpload: boolean; foundInDB: boolean; error?: string }> {
	try {
		const database = await connectToMongo();
		const { base64File, fileName, user, setPublic, reUpload, path, folderId, shareEmails } = getParamsFromRequest(req) as RequestParams;

		const { exists, document: existingFile } = await checkIfFileExists({ fileName, folderName: path, user, database });

		let driveClient, driveEmail;

		if (exists && reUpload && existingFile) {
			// Use the ownerEmail from the existing file to get the correct drive client
			({ driveClient, driveEmail } = await getDriveClient({ database, overrideEmail: existingFile.ownerEmail }));
		} else if (exists && !reUpload && existingFile) {
			return { status: true, fileDocument: existingFile, reUpload: reUpload, foundInDB: exists };
		} else {
			// Get a drive client as usual
			({ driveClient, driveEmail } = await getDriveClient({ database }));
		}

		// Pass the existing fileId if reUploading
		const fileDocument: FileDocument = await base64UploadToGoogleDrive({
			base64File,
			fileName,
			folderId,
			drive: driveClient,
			fileId: reUpload && exists ? existingFile?.id : undefined, // Use existing fileId if reUploading
		});

		if (setPublic || (shareEmails && shareEmails.length > 0)) {
			await setFilePermissions({ drive: driveClient, fileId: fileDocument.id, setPublic, shareEmails });
		}

		await saveFileRecordToDB(fileDocument);

		return { status: true, fileDocument, reUpload: reUpload, foundInDB: exists || false };
	} catch (error) {
		console.error('Failed to upload file:', error);
		return { status: false, fileDocument: null, reUpload: false, foundInDB: false, error: error.message };
	}
}

const base64UploadToGoogleDrive = async ({
	base64File,
	fileName,
	folderId,
	drive,
	fileId,
}: {
	base64File: string;
	fileName: string;
	folderId: string;
	drive: drive_v3.Drive;
	fileId?: string;
}) => {
	const mimeType = getMimeType(fileName);
	const fileMetadata = { name: fileName };
	const buffer = Buffer.from(base64File, 'base64');
	const media = { mimeType, body: Readable.from(buffer) };

	let uploadResponse;
	if (fileId) {
		// Get the current parents of the file
		const existingFile = await drive.files.get({ fileId, fields: 'parents' });
		const previousParents = existingFile.data.parents ? existingFile.data.parents.join(',') : '';

		// Remove the previous parents
		if (previousParents) {
			await drive.files.update({
				fileId,
				removeParents: previousParents,
			});
		}

		// Update existing file
		uploadResponse = await drive.files.update({
			fileId,
			addParents: folderId,
			requestBody: fileMetadata,
			media: media,
			fields,
		});
	} else {
		// Create new file
		uploadResponse = await drive.files.create({
			requestBody: { ...fileMetadata, parents: [folderId] },
			media: media,
			fields,
		});
	}

	// Generate export download URL
	const downloadUrl = `https://drive.google.com/uc?id=${uploadResponse.data.id}&export=download`;

	return { ...uploadResponse.data, downloadUrl };
};
