import { type FormEvent, useState } from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

const getUploadedItem = (uploadResult: FSItem | FSItem[] | undefined) => {
    if (!uploadResult) return null;
    if (Array.isArray(uploadResult)) return uploadResult[0] ?? null;
    return uploadResult;
};

const normalizeFeedbackText = (value: string) => {
    const trimmed = value.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
};

const Upload=()=>{
    const { fs, ai, kv} = usePuterStore();
    const [isProcessing, setIsProcessing]=useState(false);
    const [statusText,setStatusText]=useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);

    }

    const handleAnalyze=async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File})=> {
        try {
            setIsProcessing(true);

            setStatusText('Uploading the file...');
            const uploadedResumeResult = await fs.upload([file]);
            const uploadedResume = getUploadedItem(uploadedResumeResult);
            if (!uploadedResume?.path) {
                throw new Error('Failed to upload resume PDF');
            }

            setStatusText('Converting PDF to image...');
            const imageFile = await convertPdfToImage(file);
            if (!imageFile.file) {
                throw new Error(imageFile.error || 'Failed to convert PDF to image');
            }

            setStatusText('Uploading the image...');
            const uploadedImageResult = await fs.upload([imageFile.file]);
            const uploadedImage = getUploadedItem(uploadedImageResult);
            if (!uploadedImage?.path) {
                throw new Error('Failed to upload image');
            }

            setStatusText('Preparing data...');
            const uuid = generateUUID();
            const data = {
                id: uuid,
                resumePath: uploadedResume.path,
                imagePath: uploadedImage.path,
                companyName,
                jobTitle,
                jobDescription,
                feedback: '',
            };

            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setStatusText('Analyzing...');

            const feedback = await ai.feedback(
                uploadedResume.path,
                prepareInstructions({jobTitle, jobDescription})
            );
            if (!feedback) {
                throw new Error('Failed to analyze resume');
            }

            const feedbackText = typeof feedback.message.content === 'string'
                ? feedback.message.content
                : feedback.message.content[0].text;

            const parsedFeedback = JSON.parse(normalizeFeedbackText(feedbackText));
            data.feedback = parsedFeedback;
            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            // Expose in DevTools for quick inspection.
            (window as typeof window & { __lastResumeAnalysis?: typeof data }).__lastResumeAnalysis = data;
            console.log("Resume analysis object:", data);

            setStatusText('Analysis complete');
            setIsProcessing(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error during resume analysis';
            setStatusText(`Error: ${message}`);
            setIsProcessing(false);
        }
    }


    const handleSubmit=(e: FormEvent<HTMLFormElement>)=>{
       e.preventDefault();
       const form=e.currentTarget;
       const formData = new FormData(form);

       const companyName=formData.get('company-name') as string;
       const jobTitle=formData.get('job-title') as string;
       const jobDescription=formData.get('job-description') as string;

       if(!file) return;

       handleAnalyze({ companyName, jobTitle, jobDescription, file});


    }
    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full"/>
                        </>
                    ) : (
                        <>
                            <h2>Drop your resume for ATS score and improvement tips</h2>
                            {statusText.startsWith('Error:') && (
                                <p className="text-red-600 mt-2">{statusText}</p>
                            )}
                        </>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>
                            <button className="primary-button" type="submit">
                                Analyze Resume
                            </button>


                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload
