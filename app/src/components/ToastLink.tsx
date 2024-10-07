const ToastLink = ({
  signature
}: {
  signature: string
}) => {
  return (
    <>
      <a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank">
        <span>
          Transaction successed. <br /> Click to see on explorer.
        </span>
      </a>
    </>
  );
};

export default ToastLink;
