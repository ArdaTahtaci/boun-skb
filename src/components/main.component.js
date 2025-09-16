// src/Main.js
import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, parseUnits } from "ethers";

const ERC20_ABI = [
    { "inputs": [{ "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "decimals", "outputs": [{ "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "symbol", "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" }
];

export default function Main() {
    const [account, setAccount] = useState("");
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);

    const [tokenAddress, setTokenAddress] = useState("");
    const [receiverAddress, setReceiverAddress] = useState("");
    const [transferAmount, setTransferAmount] = useState("");

    const [decimals, setDecimals] = useState(18);
    const [symbol, setSymbol] = useState("TOKEN");
    const [busy, setBusy] = useState(false);

    // Provider + account refresh + MM events
    useEffect(() => {
        if (!window.ethereum) return;
        const prov = new BrowserProvider(window.ethereum);
        setProvider(prov);

        const refresh = async () => {
            try {
                const accs = await prov.send("eth_accounts", []);
                if (accs && accs.length) {
                    const s = await prov.getSigner();
                    setSigner(s);
                    setAccount(await s.getAddress());
                } else {
                    setSigner(null);
                    setAccount("");
                }
            } catch {
                setSigner(null);
                setAccount("");
            }
        };

        refresh();

        const onAcc = () => refresh();
        const onChain = () => window.location.reload();

        window.ethereum.on("accountsChanged", onAcc);
        window.ethereum.on("chainChanged", onChain);
        return () => {
            window.ethereum.removeListener("accountsChanged", onAcc);
            window.ethereum.removeListener("chainChanged", onChain);
        };
    }, []);

    // Read-only contract for metadata
    const roContract = useMemo(() => {
        if (!tokenAddress || !provider) return null;
        return new Contract(tokenAddress, ERC20_ABI, provider);
    }, [tokenAddress, provider]);

    // Load token metadata when address changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!roContract) return;
            try {
                const [d, s] = await Promise.all([
                    roContract.decimals().catch(() => 18),
                    roContract.symbol().catch(() => "TOKEN"),
                ]);
                if (!cancelled) {
                    setDecimals(Number(d));
                    setSymbol(s);
                }
            } catch { }
        })();
        return () => { cancelled = true; };
    }, [roContract]);

    // Connect button
    const connect = async () => {
        if (!window.ethereum) { alert("MetaMask gerekli."); return; }
        await window.ethereum.request({ method: "eth_requestAccounts" });

        const want = process.env.REACT_APP_CHAIN_ID;
        if (want) {
            const hex = "0x" + Number(want).toString(16);
            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: hex }],
                });
            } catch { }
        }
        // signer/account useEffect içindeki refresh ile güncellenecek
    };

    // Transfer (signer ile yerinde sözleşme oluştur)
    const transfer = async () => {
        if (!tokenAddress) { alert("Token adresi gerekli."); return; }
        if (!receiverAddress) { alert("Alıcı adresi gerekli."); return; }
        if (!transferAmount) { alert("Miktar gerekli."); return; }
        if (!signer) { alert("Önce cüzdanı bağla."); return; }

        try {
            setBusy(true);
            const writable = new Contract(tokenAddress, ERC20_ABI, signer);
            const d = Number(isFinite(decimals) ? decimals : await writable.decimals().catch(() => 18));
            const value = parseUnits(String(transferAmount), d);

            const tx = await writable.transfer(receiverAddress, value);
            const receipt = await tx.wait();
            alert(`Transfer OK: ${receipt.transactionHash}`);
        } catch (e) {
            console.error(e);
            alert(e?.shortMessage || e?.message || "Hata");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="app">
            <div className="card">
                <div className="header">
                    <div className="title">ERC20 Transfer</div>
                    {account && <div className="address">{account}</div>}
                </div>

                {!account && (
                    <div className="actions">
                        <button className="button" type="button" onClick={connect}>
                            Cüzdanı Bağla
                        </button>
                    </div>
                )}

                <div className="grid">
                    <div className="field">
                        <label className="label">Token Address</label>
                        <input
                            className="input"
                            type="text"
                            value={tokenAddress}
                            onChange={(e) => setTokenAddress(e.target.value)}
                            placeholder="0x0000..."
                        />
                    </div>

                    <div className="field">
                        <label className="label">Send to</label>
                        <input
                            className="input"
                            type="text"
                            value={receiverAddress}
                            onChange={(e) => setReceiverAddress(e.target.value)}
                            placeholder="0x0000..."
                        />
                    </div>

                    <div className="field">
                        <label className="label">Amount</label>
                        <div className="row">
                            <input
                                className="input"
                                type="text"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="0.0"
                            />
                            <span className="suffix">{symbol}</span>
                        </div>
                        <div className="note">Decimals: {decimals}</div>
                    </div>
                </div>

                <div className="actions">
                    <button
                        className="button"
                        disabled={busy || !account || !tokenAddress}
                        onClick={transfer}
                    >
                        {busy ? "Gönderiliyor…" : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
}
