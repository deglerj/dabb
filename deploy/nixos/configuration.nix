# NixOS configuration for the dabb production server (Hetzner CX23, x86_64)
#
# This file is checked into the repo and applied during NixOS installation.
# The hardware-configuration.nix is generated on the server during install:
#   nixos-generate-config --root /mnt
#
# BEFORE INSTALLING: Replace the SSH public key placeholder below with the
# contents of ~/.ssh/dabb-deploy.pub (the new key generated during secret rotation).
{ config, pkgs, ... }:
{
  imports = [ ./hardware-configuration.nix ];

  # ── Boot ────────────────────────────────────────────────────────────────────
  # Hetzner Cloud VMs support EFI but EFI NVRAM vars are not writable in the
  # installer. efiInstallAsRemovable installs to the fallback path
  # /boot/EFI/BOOT/BOOTX64.EFI instead of writing an NVRAM entry.
  boot.loader.grub = {
    enable = true;
    efiSupport = true;
    efiInstallAsRemovable = true;
    device = "nodev"; # EFI mode — no MBR
  };
  boot.loader.efi.efiSysMountPoint = "/boot";

  # ── Networking ──────────────────────────────────────────────────────────────
  networking.hostName = "dabb";

  # Only allow SSH, HTTP, and HTTPS; everything else is dropped
  networking.firewall.enable = true;
  networking.firewall.allowedTCPPorts = [ 22 80 443 ];

  # ── SSH ─────────────────────────────────────────────────────────────────────
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
    };
  };

  # ── Docker ──────────────────────────────────────────────────────────────────
  virtualisation.docker = {
    enable = true;
    # Weekly cleanup of dangling images/stopped containers
    autoPrune = {
      enable = true;
      dates = "weekly";
    };
  };

  # ── Users ───────────────────────────────────────────────────────────────────
  # Disable mutable users — all users are declared here
  users.mutableUsers = false;

  users.users.dabb = {
    isNormalUser = true;
    home = "/opt/dabb";
    createHome = true;
    shell = pkgs.bash;
    extraGroups = [ "wheel" "docker" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL6NBBqd7Zn0uD44Eur5KOFnyYq0FrwU3atuVw70c7Gi dabb-deploy"
    ];
  };

  # ── System packages ─────────────────────────────────────────────────────────
  environment.systemPackages = with pkgs; [
    git
    curl
    vim
    htop
    docker-compose
  ];

  # ── Automatic OS upgrades ───────────────────────────────────────────────────
  system.autoUpgrade = {
    enable = true;
    allowReboot = true;
    channel = "https://nixos.org/channels/nixos-25.05";
  };

  # ── Nix garbage collection ──────────────────────────────────────────────────
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  # ── State version ───────────────────────────────────────────────────────────
  # Never change this after first install — it controls stateful migration behaviour
  system.stateVersion = "25.05";
}
