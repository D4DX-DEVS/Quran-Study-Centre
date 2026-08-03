import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Container, HeaderMenu, Status } from "./styels";
import ProfileBar from "../profile";
import { GetIcon } from "../../../../icons";
import { avathar } from "../../../../images";
import SearchMenu from "./SearchMenu";
const Header = (props) => {
  const [isProfileBarOpen, setIsProfileBarOpen] = useState(false);
  const profileRef = useRef(null);
  const { user } = props;
  // Function to handle clicks outside of the Profile component
  const handleClickOutside = (event) => {
    if (profileRef.current && !profileRef.current.contains(event.target)) {
      setIsProfileBarOpen(false);
    }
  };

  // Add a click event listener when the component mounts
  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Toggle the ProfileBar when clicking the Profile
  const handleProfileClick = () => {
    setIsProfileBarOpen(!isProfileBarOpen);
  };
  // const navigate = useNavigate();
  return (
    <Container className={isProfileBarOpen ? "profile-open" : ""}>
      <Status>
        <button
          type="button"
          aria-label="Toggle sidebar"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-stroke-soft text-icon-sub hover:bg-bg-weak hover:text-icon-strong transition-colors mr-3 shrink-0"
          onClick={() => props.onToggleSidebar?.()}
        >
          <GetIcon icon={"menu"} />
        </button>
        <div className="flex-1" />
        <SearchMenu isMobile={props.isMobile} />
        <div className="flex items-center gap-2 pl-4 pr-4">
          <button type="button" aria-label="Notifications" className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-icon-sub hover:bg-bg-weak hover:text-icon-strong transition-colors">
            <Bell size={18} strokeWidth={2} />
          </button>
        </div>
        <HeaderMenu
          ref={profileRef}
          onClick={() => {
            handleProfileClick();
          }}
        >
          <div className="flex items-center gap-2 p-2 rounded-md">
            <img className="w-6 h-6 rounded-full" src={user.photo?.length > 5 ? `${import.meta.env.VITE_CDN}${user.photo}` : avathar} alt="profile" />
            <i className="hidden md:block">{user?.fullName ?? user?.username}</i>
          </div>
          <GetIcon icon={"down-small"}></GetIcon>
          {isProfileBarOpen && (
            <div className="ProfileBar" onClick={(e) => e.stopPropagation()}>
              <ProfileBar close={() => setIsProfileBarOpen(false)} setLoaderBox={props.setLoaderBox} setMessage={props.setMessage} user={user}></ProfileBar>
            </div>
          )}
        </HeaderMenu>
      </Status>
    </Container>
  );
};

export default Header;
