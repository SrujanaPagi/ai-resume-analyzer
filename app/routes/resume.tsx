import {Link, useNavigate, useParams} from "react-router";
import {useEffect, useState} from "react";
import {usePuterStore} from "~/lib/puter";
import {resumes} from "../../constants";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";

export const meta=()=>([
    { title: 'Resumind | Review '},
    { name: 'description', content: 'Detailed overview of your resume' },
])
const Resume=()=>{
    const { auth, isLoading, puterReady, fs, kv } = usePuterStore();
    const { id } = useParams();
    const [imageUrl, setImageUrl] = useState('');
    const [resumeUrl, setResumeUrl] = useState('');
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [loadError, setLoadError] = useState('');
    const [isResumeLoading, setIsResumeLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(()=>{
        const fallbackResume = resumes.find((item) => item.id === id);
        if (fallbackResume) {
            setLoadError('');
            setImageUrl(fallbackResume.imagePath);
            setResumeUrl(fallbackResume.resumePath);
            setFeedback(fallbackResume.feedback as Feedback);
            setIsResumeLoading(false);
            return;
        }

        if (!puterReady || isLoading) return;

        if (!auth.isAuthenticated) {
            navigate(`/auth?next=/resume/${id}`);
            return;
        }

        let isMounted = true;
        let localImageUrl = "";
        let localResumeUrl = "";

        const loadResume= async ()=>{
            try {
                setIsResumeLoading(true);
                setLoadError('');
                const resume= await kv.get(`resume:${id}`);

                if(!resume) {
                    setLoadError('Resume record not found.');
                    setIsResumeLoading(false);
                    return;
                }
                const data = JSON.parse(resume);

                const resumeBlob = await fs.read(data.resumePath);
                if(!resumeBlob) {
                    setLoadError('Uploaded PDF could not be loaded.');
                    setIsResumeLoading(false);
                    return;
                }

                const pdfBlob=new Blob([resumeBlob],{type: "application/pdf"});
                const resumeUrl= URL.createObjectURL(pdfBlob);
                localResumeUrl = resumeUrl;
                if (isMounted) setResumeUrl(resumeUrl);

                const imageBlob=await fs.read(data.imagePath);
                if(!imageBlob) {
                    setLoadError('Generated resume preview image could not be loaded.');
                    setIsResumeLoading(false);
                    return;
                }
                const imageType = data.imagePath?.toLowerCase().endsWith(".png")
                    ? "image/png"
                    : "image/jpeg";
                const imageUrl=URL.createObjectURL(new Blob([imageBlob], { type: imageType }));
                localImageUrl = imageUrl;
                if (isMounted) setImageUrl(imageUrl);

                if (isMounted) setFeedback(data.feedback);
                console.log({resumeUrl, imageUrl, feedback:data.feedback});
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load resume";
                if (isMounted) setLoadError(message);
            } finally {
                if (isMounted) setIsResumeLoading(false);
            }

        }
        loadResume();

        return () => {
            isMounted = false;
            if (localImageUrl) URL.revokeObjectURL(localImageUrl);
            if (localResumeUrl) URL.revokeObjectURL(localResumeUrl);
        };
    },[auth.isAuthenticated, id, isLoading, kv, fs, navigate, puterReady]);
    return(
        <main className="pt-0!">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5"/>
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-screen sticky top-0 items-center justify-center">
                    {auth.isAuthenticated && isResumeLoading && (
                        <img src="/images/resume-scan-2.gif" alt="Loading resume" className="w-full max-w-xl" />
                    )}
                    {loadError && (
                        <p className="text-red-600 text-sm">{loadError}</p>
                    )}
                    {!isResumeLoading && imageUrl &&(
                        <div className="animate-in fade-in duration-1000 gradient-border max-smm-0 h-[90%] max-wxl:h-fit w-fit">
                            <a href={resumeUrl || imageUrl} target="_blank" rel="noreferrer">
                                <img
                                    src={imageUrl}
                                    className="h-full w-full object-contain rounded-2xl"
                                    title="resume"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl text-black! font-bold">Resume Review</h2>
                    {feedback ? (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS.score || 0} suggestions={feedback.ATS.tips || []} />
                            <Details feedback={feedback} />
                        </div>
                    ) : (
                        <img src="/images/resume-scan-2.gif" className="w-full" />
                    )}
                </section>
            </div>
        </main>
    )
}
export default Resume;
